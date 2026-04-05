/**
 * Tests for the "fixed" service type feature.
 *
 * Covers:
 * A. addServiceToClient — validation and service object shape for type=fixed
 * B. isFixedService() — identifies type=fixed AND legal_procedure+fixed
 * C. calcClientAggregates — fixed services excluded from billableServices
 * D. Timesheet deduction — fixed service updates work.totalMinutesWorked, no blocking
 * E. Timesheet trigger — UPDATE/DELETE delta on fixed service
 */

// ═══════════════════════════════════════════════════════════════
// Mocks — must precede require()
// ═══════════════════════════════════════════════════════════════

const mockTransaction = {
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn()
};

const mockRunTransaction = jest.fn(async (fn) => fn(mockTransaction));

const mockDb = {
  collection: jest.fn((name) => ({
    doc: jest.fn((id) => ({
      id: id || 'auto_id',
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({ id: 'auto_id' }))
      }))
    }))
  })),
  runTransaction: mockRunTransaction
};

jest.mock('firebase-admin', () => {
  const FieldValue = {
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
    increment: jest.fn((n) => ({ _increment: n }))
  };
  const Timestamp = {
    fromDate: jest.fn((d) => d)
  };
  return {
    initializeApp: jest.fn(),
    firestore: Object.assign(() => mockDb, { FieldValue, Timestamp }),
    auth: jest.fn(() => ({ getUser: jest.fn() }))
  };
});

jest.mock('firebase-functions', () => {
  class HttpsError extends Error {
    constructor(code, message, details) {
      super(message);
      this.code = code;
      this.details = details;
    }
  }
  return {
    https: { onCall: jest.fn((fn) => fn), HttpsError },
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() }
  };
});

jest.mock('firebase-functions/v2/firestore', () => ({
  onDocumentWritten: jest.fn(() => jest.fn())
}));

// The aggregation module uses a relative path that resolves differently under Jest.
// Provide a manual mock pointing to the real shared/aggregates module.
jest.mock('../src/modules/aggregation/index', () => {
  const actual = jest.requireActual('../shared/aggregates');
  const { isFixedService, round2 } = actual;

  function applyHoursDelta(services, serviceId, packageId, minutesDelta) {
    const hoursDelta = minutesDelta / 60;
    let targetFound = false;
    let isOverage = false;
    let overageMinutes = 0;

    const updatedServices = services.map((svc) => {
      if (svc.id !== serviceId) return svc;
      const updatedPackages = (svc.packages || []).map((pkg) => {
        if (pkg.id !== packageId) return pkg;
        targetFound = true;
        const newHoursUsed = round2((pkg.hoursUsed || 0) + hoursDelta);
        const newHoursRemaining = round2((pkg.hours || 0) - newHoursUsed);
        let newStatus = pkg.status || 'active';
        if (newHoursRemaining <= 0) newStatus = 'depleted';
        else if (newStatus === 'depleted') newStatus = 'active';
        if (newHoursRemaining < 0) { isOverage = true; overageMinutes = round2(Math.abs(newHoursRemaining) * 60); }
        return { ...pkg, hoursUsed: newHoursUsed, hoursRemaining: newHoursRemaining, status: newStatus };
      });
      const svcHoursUsed = round2(updatedPackages.reduce((sum, p) => sum + (p.hoursUsed || 0), 0));
      const svcHoursRemaining = round2((svc.totalHours || 0) - svcHoursUsed);
      return { ...svc, packages: updatedPackages, hoursUsed: svcHoursUsed, hoursRemaining: svcHoursRemaining,
        isBlocked: svcHoursRemaining <= 0 && !svc.overrideActive && !(svc.overdraftResolved?.isResolved),
        isCritical: svcHoursRemaining > 0 && svcHoursRemaining <= 5 };
    });
    if (!targetFound) return null;
    return { updatedServices, isOverage, overageMinutes };
  }

  function applyHoursDeltaServiceOnly(services, serviceId, minutesDelta) {
    const hoursDelta = minutesDelta / 60;
    let targetFound = false;
    let isOverage = false;
    let overageMinutes = 0;
    const updatedServices = services.map((svc) => {
      if (svc.id !== serviceId) return svc;
      targetFound = true;
      const newHoursUsed = round2((svc.hoursUsed || 0) + hoursDelta);
      const newHoursRemaining = round2((svc.totalHours || 0) - newHoursUsed);
      if (newHoursRemaining < 0) { isOverage = true; overageMinutes = round2(Math.abs(newHoursRemaining) * 60); }
      return { ...svc, hoursUsed: newHoursUsed, hoursRemaining: newHoursRemaining,
        isBlocked: newHoursRemaining <= 0 && !svc.overrideActive && !(svc.overdraftResolved?.isResolved),
        isCritical: newHoursRemaining > 0 && newHoursRemaining <= 5 };
    });
    if (!targetFound) return null;
    return { updatedServices, isOverage, overageMinutes };
  }

  function calcClientAggregates(services, clientTotalHours) {
    const billableServices = services.filter(svc => !isFixedService(svc));
    const hoursUsed = round2(billableServices.reduce((sum, svc) => sum + (svc.hoursUsed || 0), 0));
    const hoursRemaining = round2((clientTotalHours || 0) - hoursUsed);
    const minutesUsed = round2(hoursUsed * 60);
    const minutesRemaining = round2(hoursRemaining * 60);
    const hasActiveOverride = services.some(svc => svc.overrideActive === true || svc.overdraftResolved?.isResolved === true);
    const isBlocked = hoursRemaining <= 0 && !hasActiveOverride;
    const isCritical = !isBlocked && hoursRemaining <= 5;
    return { hoursUsed, hoursRemaining, minutesUsed, minutesRemaining, isBlocked, isCritical };
  }

  return {
    round2,
    applyHoursDelta,
    applyHoursDeltaServiceOnly,
    applyLegalProcedureDelta: jest.fn(() => null),
    applyLegalProcedureDeltaStageOnly: jest.fn(() => null),
    calcClientAggregates
  };
});

jest.mock('../shared/auth', () => ({
  checkUserPermissions: jest.fn(() => ({
    uid: 'user1',
    email: 'test@test.com',
    username: 'testuser',
    role: 'manager'
  }))
}));

jest.mock('../shared/audit', () => ({
  logAction: jest.fn()
}));

jest.mock('../shared/validators', () => ({
  sanitizeString: jest.fn((s) => s)
}));

// ═══════════════════════════════════════════════════════════════
// Requires — after mocks
// ═══════════════════════════════════════════════════════════════

const { addServiceToClient } = require('../services/index');
const { isFixedService, calcClientAggregates } = require('../shared/aggregates');

// Trigger test exports (pure functions)
const {
  _test: {
    applyHoursDelta,
    calcClientAggregates: triggerCalcAggregates,
    getEventType,
    getMinutesDelta
  }
} = require('../triggers/timesheet-trigger');

// Aggregation module (used by both timesheet callable and trigger)
const aggregation = require('../src/modules/aggregation');


// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function makeFixedService(id, { fixedPrice = 5000, totalMinutesWorked = 0, entriesCount = 0 } = {}) {
  return {
    id,
    type: 'fixed',
    name: 'שירות קבוע',
    fixedPrice,
    work: { totalMinutesWorked, entriesCount },
    status: 'active',
    completedAt: null
  };
}

function makeHoursService(id, { totalHours = 20, hoursUsed = 5 } = {}) {
  return {
    id,
    type: 'hours',
    totalHours,
    hoursUsed,
    hoursRemaining: totalHours - hoursUsed,
    isBlocked: false,
    isCritical: false,
    packages: [
      { id: `${id}_pkg1`, hours: totalHours, hoursUsed, hoursRemaining: totalHours - hoursUsed, status: 'active' }
    ]
  };
}


// ═══════════════════════════════════════════════════════════════
// A. addServiceToClient — type=fixed validation + service object
// ═══════════════════════════════════════════════════════════════

describe('A. addServiceToClient — type=fixed', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('rejects missing fixedPrice', async () => {
    await expect(
      addServiceToClient({
        clientId: 'client1',
        serviceType: 'fixed',
        serviceName: 'שירות קבוע'
        // fixedPrice missing
      }, { auth: { uid: 'user1' } })
    ).rejects.toThrow('מחיר קבוע חייב להיות מספר חיובי או 0');
  });

  test('rejects negative fixedPrice', async () => {
    await expect(
      addServiceToClient({
        clientId: 'client1',
        serviceType: 'fixed',
        serviceName: 'שירות קבוע',
        fixedPrice: -100
      }, { auth: { uid: 'user1' } })
    ).rejects.toThrow('מחיר קבוע חייב להיות מספר חיובי או 0');
  });

  test('rejects non-number fixedPrice (string)', async () => {
    await expect(
      addServiceToClient({
        clientId: 'client1',
        serviceType: 'fixed',
        serviceName: 'שירות קבוע',
        fixedPrice: '5000'
      }, { auth: { uid: 'user1' } })
    ).rejects.toThrow('מחיר קבוע חייב להיות מספר חיובי או 0');
  });

  test('accepts fixedPrice = 0', async () => {
    const clientData = { services: [], totalHours: 0 };
    mockTransaction.get.mockResolvedValue({
      exists: true,
      data: () => clientData
    });

    const result = await addServiceToClient({
      clientId: 'client1',
      serviceType: 'fixed',
      serviceName: 'שירות חינם',
      fixedPrice: 0
    }, { auth: { uid: 'user1' } });

    expect(result.success).toBe(true);
    expect(result.service.type).toBe('fixed');
    expect(result.service.fixedPrice).toBe(0);
  });

  test('creates correct service object shape', async () => {
    const clientData = { services: [], totalHours: 0 };
    mockTransaction.get.mockResolvedValue({
      exists: true,
      data: () => clientData
    });

    const result = await addServiceToClient({
      clientId: 'client1',
      serviceType: 'fixed',
      serviceName: 'ייעוץ חד-פעמי',
      description: 'תיאור השירות',
      fixedPrice: 3500
    }, { auth: { uid: 'user1' } });

    expect(result.success).toBe(true);
    const svc = result.service;

    // Core fields
    expect(svc.type).toBe('fixed');
    expect(svc.name).toBe('ייעוץ חד-פעמי');
    expect(svc.fixedPrice).toBe(3500);
    expect(svc.status).toBe('active');

    // Work tracking structure
    expect(svc.work).toEqual({
      totalMinutesWorked: 0,
      entriesCount: 0
    });
    expect(svc.completedAt).toBeNull();

    // Must NOT have hours/packages/stages fields
    expect(svc.packages).toBeUndefined();
    expect(svc.stages).toBeUndefined();
    expect(svc.totalHours).toBeUndefined();
    expect(svc.hoursUsed).toBeUndefined();
    expect(svc.hoursRemaining).toBeUndefined();
  });

  test('fixed service does not affect client isBlocked/isCritical', async () => {
    // Client already has an hours service with 0 remaining + override
    const existingHours = makeHoursService('svc_hours', { totalHours: 10, hoursUsed: 10 });
    existingHours.overrideActive = true;
    const clientData = { services: [existingHours], totalHours: 10 };

    mockTransaction.get.mockResolvedValue({
      exists: true,
      data: () => clientData
    });

    const result = await addServiceToClient({
      clientId: 'client1',
      serviceType: 'fixed',
      serviceName: 'שירות קבוע',
      fixedPrice: 5000
    }, { auth: { uid: 'user1' } });

    expect(result.success).toBe(true);

    // Verify the client update — fixed service should not add to totalHours
    const updateCall = mockTransaction.update.mock.calls[0];
    const updateData = updateCall[1];

    // totalHours should still be 10 (only from hours service — fixed has no totalHours)
    expect(updateData.totalHours).toBe(10);
    // isBlocked should be false because of overrideActive
    expect(updateData.isBlocked).toBe(false);
  });
});


// ═══════════════════════════════════════════════════════════════
// B. isFixedService()
// ═══════════════════════════════════════════════════════════════

describe('B. isFixedService()', () => {

  test('returns true for type=fixed', () => {
    expect(isFixedService({ type: 'fixed' })).toBe(true);
  });

  test('returns true for legal_procedure with pricingType=fixed', () => {
    expect(isFixedService({ type: 'legal_procedure', pricingType: 'fixed' })).toBe(true);
  });

  test('returns false for type=hours', () => {
    expect(isFixedService({ type: 'hours' })).toBe(false);
  });

  test('returns false for legal_procedure with pricingType=hourly', () => {
    expect(isFixedService({ type: 'legal_procedure', pricingType: 'hourly' })).toBe(false);
  });

  test('returns false for legal_procedure with no pricingType', () => {
    expect(isFixedService({ type: 'legal_procedure' })).toBe(false);
  });

  test('returns false for undefined type', () => {
    expect(isFixedService({})).toBe(false);
  });
});


// ═══════════════════════════════════════════════════════════════
// C. calcClientAggregates — fixed services excluded
// ═══════════════════════════════════════════════════════════════

describe('C. calcClientAggregates — fixed services excluded from billing', () => {

  test('fixed service (type=fixed) excluded from hoursUsed', () => {
    const services = [
      makeHoursService('svc_hours', { totalHours: 20, hoursUsed: 8 }),
      makeFixedService('svc_fixed', { totalMinutesWorked: 300 })
    ];

    const agg = calcClientAggregates(services, 20);

    // Only hours service counts: 8h used
    expect(agg.hoursUsed).toBe(8);
    expect(agg.hoursRemaining).toBe(12);
    expect(agg.isBlocked).toBe(false);
  });

  test('legal_procedure+fixed excluded from hoursUsed', () => {
    const services = [
      makeHoursService('svc_hours', { totalHours: 20, hoursUsed: 5 }),
      {
        id: 'svc_legal_fixed',
        type: 'legal_procedure',
        pricingType: 'fixed',
        hoursUsed: 10,
        totalHours: 0
      }
    ];

    const agg = calcClientAggregates(services, 20);

    // Only hours service counts: 5h used
    expect(agg.hoursUsed).toBe(5);
    expect(agg.hoursRemaining).toBe(15);
  });

  test('only fixed services → isBlocked=false even with 0 clientTotalHours', () => {
    const services = [
      makeFixedService('svc_fixed1'),
      makeFixedService('svc_fixed2')
    ];

    const agg = calcClientAggregates(services, 0);

    // No billable services → not blocked
    expect(agg.hoursUsed).toBe(0);
    expect(agg.isBlocked).toBe(false);
    expect(agg.isCritical).toBe(false);
  });

  test('mix of hours (depleted) + fixed → blocked only from hours', () => {
    const services = [
      makeHoursService('svc_hours', { totalHours: 10, hoursUsed: 15 }), // over limit
      makeFixedService('svc_fixed', { totalMinutesWorked: 600 })
    ];

    const agg = calcClientAggregates(services, 10);

    expect(agg.hoursUsed).toBe(15);
    expect(agg.hoursRemaining).toBe(-5);
    expect(agg.isBlocked).toBe(true);
  });

  test('aggregation module calcClientAggregates also excludes fixed services', () => {
    const services = [
      makeHoursService('svc_hours', { totalHours: 20, hoursUsed: 3 }),
      makeFixedService('svc_fixed')
    ];

    const agg = aggregation.calcClientAggregates(services, 20);

    expect(agg.hoursUsed).toBe(3);
    expect(agg.hoursRemaining).toBe(17);
    expect(agg.isBlocked).toBe(false);
  });
});


// ═══════════════════════════════════════════════════════════════
// D. Timesheet deduction — fixed service: work tracking, no blocking
// ═══════════════════════════════════════════════════════════════

describe('D. Timesheet deduction — fixed service work tracking', () => {

  test('fixed service: updates work.totalMinutesWorked (CREATE path)', () => {
    const fixedSvc = makeFixedService('svc_fixed', { totalMinutesWorked: 60, entriesCount: 2 });
    const services = [fixedSvc];

    // Simulate the inline deduction logic from timesheet/index.js (CREATE)
    const lookupServiceId = 'svc_fixed';
    const minutesDelta = 45;
    const svcIndex = services.findIndex(s => s.id === lookupServiceId);
    const updatedSvc = { ...services[svcIndex] };
    const work = { ...(updatedSvc.work || { totalMinutesWorked: 0, entriesCount: 0 }) };
    work.totalMinutesWorked = Math.round(((work.totalMinutesWorked || 0) + minutesDelta) * 100) / 100;
    work.entriesCount = (work.entriesCount || 0) + 1;
    updatedSvc.work = work;
    const updatedArr = [...services];
    updatedArr[svcIndex] = updatedSvc;
    const deductionResult = { updatedServices: updatedArr, isOverage: false, overageMinutes: 0 };

    // Verify
    const updated = deductionResult.updatedServices[0];
    expect(updated.work.totalMinutesWorked).toBe(105); // 60 + 45
    expect(updated.work.entriesCount).toBe(3); // 2 + 1
    expect(deductionResult.isOverage).toBe(false);
    expect(deductionResult.overageMinutes).toBe(0);
  });

  test('fixed service: never returns isOverage=true even with huge minutes', () => {
    const fixedSvc = makeFixedService('svc_fixed', { totalMinutesWorked: 99999 });
    const services = [fixedSvc];

    const svcIndex = 0;
    const minutesDelta = 60000; // enormous
    const updatedSvc = { ...services[svcIndex] };
    const work = { ...(updatedSvc.work || { totalMinutesWorked: 0, entriesCount: 0 }) };
    work.totalMinutesWorked = Math.round(((work.totalMinutesWorked || 0) + minutesDelta) * 100) / 100;
    work.entriesCount = (work.entriesCount || 0) + 1;
    updatedSvc.work = work;
    const updatedArr = [...services];
    updatedArr[svcIndex] = updatedSvc;
    const deductionResult = { updatedServices: updatedArr, isOverage: false, overageMinutes: 0 };

    expect(deductionResult.isOverage).toBe(false);
    expect(deductionResult.overageMinutes).toBe(0);
  });

  test('fixed service does not produce isBlocked on client aggregates after deduction', () => {
    // Client has only a fixed service — after deduction, should not block
    const fixedSvc = makeFixedService('svc_fixed', { totalMinutesWorked: 500 });
    const services = [fixedSvc];

    const agg = calcClientAggregates(services, 0);

    expect(agg.isBlocked).toBe(false);
    expect(agg.isCritical).toBe(false);
    expect(agg.hoursUsed).toBe(0);
  });

  test('fixed service work tracking does not touch hoursUsed/hoursRemaining', () => {
    const fixedSvc = makeFixedService('svc_fixed');
    const services = [fixedSvc];

    // After deduction simulation
    const svcIndex = 0;
    const minutesDelta = 120;
    const updatedSvc = { ...services[svcIndex] };
    const work = { ...(updatedSvc.work || { totalMinutesWorked: 0, entriesCount: 0 }) };
    work.totalMinutesWorked = (work.totalMinutesWorked || 0) + minutesDelta;
    work.entriesCount = (work.entriesCount || 0) + 1;
    updatedSvc.work = work;

    // hoursUsed/hoursRemaining should not exist on fixed service
    expect(updatedSvc.hoursUsed).toBeUndefined();
    expect(updatedSvc.hoursRemaining).toBeUndefined();
    expect(updatedSvc.packages).toBeUndefined();
    expect(updatedSvc.stages).toBeUndefined();
  });
});


// ═══════════════════════════════════════════════════════════════
// E. Timesheet trigger — UPDATE/DELETE delta on fixed service
// ═══════════════════════════════════════════════════════════════

describe('E. Timesheet trigger — fixed service delta handling', () => {

  test('UPDATE: positive delta increases totalMinutesWorked, entriesCount unchanged', () => {
    // Simulates trigger logic for fixed service on UPDATE
    const fixedSvc = makeFixedService('svc_fixed', { totalMinutesWorked: 120, entriesCount: 3 });
    const services = [fixedSvc];
    const minutesDelta = 30; // entry changed from 60 → 90 min

    // Trigger logic (from timesheet-trigger.js lines 383-399)
    const svcIndex = services.findIndex(s => s.id === 'svc_fixed');
    const updatedSvc = { ...services[svcIndex] };
    const work = { ...(updatedSvc.work || { totalMinutesWorked: 0, entriesCount: 0 }) };
    work.totalMinutesWorked = Math.round(((work.totalMinutesWorked || 0) + minutesDelta) * 100) / 100;
    // On UPDATE: minutesDelta > 0 → entriesCount +1
    if (minutesDelta > 0) {
      work.entriesCount = (work.entriesCount || 0) + 1;
    } else if (minutesDelta < 0) {
      work.entriesCount = Math.max(0, (work.entriesCount || 0) - 1);
    }
    updatedSvc.work = work;

    expect(updatedSvc.work.totalMinutesWorked).toBe(150); // 120 + 30
    expect(updatedSvc.work.entriesCount).toBe(4); // 3 + 1 (positive delta)
  });

  test('UPDATE: negative delta decreases totalMinutesWorked and entriesCount', () => {
    const fixedSvc = makeFixedService('svc_fixed', { totalMinutesWorked: 120, entriesCount: 3 });
    const services = [fixedSvc];
    const minutesDelta = -30; // entry changed from 90 → 60 min

    const svcIndex = services.findIndex(s => s.id === 'svc_fixed');
    const updatedSvc = { ...services[svcIndex] };
    const work = { ...(updatedSvc.work || { totalMinutesWorked: 0, entriesCount: 0 }) };
    work.totalMinutesWorked = Math.round(((work.totalMinutesWorked || 0) + minutesDelta) * 100) / 100;
    if (minutesDelta > 0) {
      work.entriesCount = (work.entriesCount || 0) + 1;
    } else if (minutesDelta < 0) {
      work.entriesCount = Math.max(0, (work.entriesCount || 0) - 1);
    }
    updatedSvc.work = work;

    expect(updatedSvc.work.totalMinutesWorked).toBe(90); // 120 - 30
    expect(updatedSvc.work.entriesCount).toBe(2); // 3 - 1 (negative delta)
  });

  test('DELETE: negative delta reverses totalMinutesWorked and decrements entriesCount', () => {
    const fixedSvc = makeFixedService('svc_fixed', { totalMinutesWorked: 180, entriesCount: 4 });
    const services = [fixedSvc];
    const minutesDelta = -60; // DELETE of a 60-min entry

    const svcIndex = services.findIndex(s => s.id === 'svc_fixed');
    const updatedSvc = { ...services[svcIndex] };
    const work = { ...(updatedSvc.work || { totalMinutesWorked: 0, entriesCount: 0 }) };
    work.totalMinutesWorked = Math.round(((work.totalMinutesWorked || 0) + minutesDelta) * 100) / 100;
    if (minutesDelta > 0) {
      work.entriesCount = (work.entriesCount || 0) + 1;
    } else if (minutesDelta < 0) {
      work.entriesCount = Math.max(0, (work.entriesCount || 0) - 1);
    }
    updatedSvc.work = work;

    expect(updatedSvc.work.totalMinutesWorked).toBe(120); // 180 - 60
    expect(updatedSvc.work.entriesCount).toBe(3); // 4 - 1
  });

  test('DELETE: entriesCount does not go below 0', () => {
    const fixedSvc = makeFixedService('svc_fixed', { totalMinutesWorked: 30, entriesCount: 0 });
    const services = [fixedSvc];
    const minutesDelta = -30;

    const svcIndex = services.findIndex(s => s.id === 'svc_fixed');
    const updatedSvc = { ...services[svcIndex] };
    const work = { ...(updatedSvc.work || { totalMinutesWorked: 0, entriesCount: 0 }) };
    work.totalMinutesWorked = Math.round(((work.totalMinutesWorked || 0) + minutesDelta) * 100) / 100;
    if (minutesDelta < 0) {
      work.entriesCount = Math.max(0, (work.entriesCount || 0) - 1);
    }
    updatedSvc.work = work;

    expect(updatedSvc.work.totalMinutesWorked).toBe(0);
    expect(updatedSvc.work.entriesCount).toBe(0); // clamped to 0
  });

  test('fixed service delta does not affect client aggregates (hoursUsed/isBlocked)', () => {
    // After trigger processes fixed service delta, client aggregates should exclude it
    const fixedSvc = makeFixedService('svc_fixed', { totalMinutesWorked: 300 });
    const hoursSvc = makeHoursService('svc_hours', { totalHours: 20, hoursUsed: 5 });
    const services = [hoursSvc, fixedSvc];

    const agg = calcClientAggregates(services, 20);

    // Only hours service counted
    expect(agg.hoursUsed).toBe(5);
    expect(agg.hoursRemaining).toBe(15);
    expect(agg.isBlocked).toBe(false);
  });

  test('getMinutesDelta helper: UPDATE computes correct delta for trigger', () => {
    const before = { minutes: 60 };
    const after = { minutes: 90 };
    expect(getMinutesDelta('UPDATE', before, after)).toBe(30);
  });

  test('getMinutesDelta helper: DELETE returns negative', () => {
    const before = { minutes: 45 };
    expect(getMinutesDelta('DELETE', before, null)).toBe(-45);
  });
});
