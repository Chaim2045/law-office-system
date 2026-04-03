/**
 * Unit tests for timesheet-trigger pure functions.
 *
 * These test the in-memory array logic (applyHoursDelta, applyServiceTransfer,
 * calcClientAggregates, etc.) WITHOUT touching Firestore.
 */

// Mock firebase-admin before requiring the trigger
jest.mock('firebase-admin', () => ({
  firestore: () => ({}),
  initializeApp: jest.fn()
}));

// Mock firebase-functions/v2/firestore
jest.mock('firebase-functions/v2/firestore', () => ({
  onDocumentWritten: jest.fn(() => jest.fn())
}));

const {
  _test: {
    applyHoursDelta,
    applyHoursDeltaServiceOnly,
    applyLegalProcedureDelta,
    applyLegalProcedureDeltaStageOnly,
    applyServiceTransfer,
    calcClientAggregates,
    getEventType,
    getMinutesDelta
  }
} = require('./timesheet-trigger');


// ═══════════════════════════════════════════════════════════════
// Test fixtures
// ═══════════════════════════════════════════════════════════════

function makeHoursService(id, { totalHours = 20, hoursUsed = 5, packages = null, overrideActive = false, overdraftResolved = null } = {}) {
  const svc = {
    id,
    type: 'hours',
    totalHours,
    hoursUsed,
    hoursRemaining: totalHours - hoursUsed,
    isBlocked: false,
    isCritical: false,
    packages: packages || [
      {
        id: `${id}_pkg1`,
        hours: totalHours,
        hoursUsed,
        hoursRemaining: totalHours - hoursUsed,
        status: 'active'
      }
    ]
  };
  if (overrideActive) svc.overrideActive = true;
  if (overdraftResolved) svc.overdraftResolved = overdraftResolved;
  return svc;
}

function makeLegalProcedureService(id, { stages = null, pricingType = null } = {}) {
  return {
    id,
    type: 'legal_procedure',
    pricingType: pricingType || 'hourly',
    totalHours: 30,
    hoursUsed: 10,
    hoursRemaining: 20,
    stages: stages || [
      {
        id: 'stage_a',
        pricingType: 'hourly',
        totalHours: 30,
        hoursUsed: 10,
        hoursRemaining: 20,
        packages: [
          { id: 'stage_a_pkg1', hours: 30, hoursUsed: 10, hoursRemaining: 20, status: 'active' }
        ]
      }
    ]
  };
}


// ═══════════════════════════════════════════════════════════════
// getEventType / getMinutesDelta
// ═══════════════════════════════════════════════════════════════

describe('getEventType', () => {
  test('CREATE: before=null, after exists', () => {
    expect(getEventType(null, { minutes: 60 })).toBe('CREATE');
  });
  test('UPDATE: both exist', () => {
    expect(getEventType({ minutes: 30 }, { minutes: 60 })).toBe('UPDATE');
  });
  test('DELETE: before exists, after=null', () => {
    expect(getEventType({ minutes: 60 }, null)).toBe('DELETE');
  });
});

describe('getMinutesDelta', () => {
  test('CREATE returns after.minutes', () => {
    expect(getMinutesDelta('CREATE', null, { minutes: 45 })).toBe(45);
  });
  test('UPDATE returns difference', () => {
    expect(getMinutesDelta('UPDATE', { minutes: 30 }, { minutes: 90 })).toBe(60);
  });
  test('DELETE returns negative before.minutes', () => {
    expect(getMinutesDelta('DELETE', { minutes: 45 }, null)).toBe(-45);
  });
  test('handles missing minutes gracefully', () => {
    expect(getMinutesDelta('CREATE', null, {})).toBe(0);
    expect(getMinutesDelta('UPDATE', {}, {})).toBe(0);
  });
});


// ═══════════════════════════════════════════════════════════════
// Bug A: applyServiceTransfer — two-legged operation
// ═══════════════════════════════════════════════════════════════

describe('Bug A: applyServiceTransfer', () => {

  test('transfer with same minutes (minutesDelta === 0): old decremented, new incremented', () => {
    const svcA = makeHoursService('svc_A', { totalHours: 20, hoursUsed: 5 });
    const svcB = makeHoursService('svc_B', { totalHours: 20, hoursUsed: 0 });
    const services = [svcA, svcB];

    const result = applyServiceTransfer(
      services,
      { serviceId: 'svc_A', parentServiceId: null, stageId: null, packageId: 'svc_A_pkg1', minutes: 60 },
      { serviceId: 'svc_B', parentServiceId: null, stageId: null, packageId: 'svc_B_pkg1', minutes: 60 }
    );

    expect(result).not.toBeNull();
    const updatedA = result.updatedServices.find(s => s.id === 'svc_A');
    const updatedB = result.updatedServices.find(s => s.id === 'svc_B');

    // svc_A: was 5h used, minus 1h (60min) = 4h used
    expect(updatedA.hoursUsed).toBe(4);
    expect(updatedA.hoursRemaining).toBe(16);
    expect(updatedA.packages[0].hoursUsed).toBe(4);

    // svc_B: was 0h used, plus 1h (60min) = 1h used
    expect(updatedB.hoursUsed).toBe(1);
    expect(updatedB.hoursRemaining).toBe(19);
    expect(updatedB.packages[0].hoursUsed).toBe(1);
  });

  test('transfer with different minutes: old reversed by before.minutes, new applied by after.minutes', () => {
    const svcA = makeHoursService('svc_A', { totalHours: 20, hoursUsed: 5 });
    const svcB = makeHoursService('svc_B', { totalHours: 20, hoursUsed: 0 });
    const services = [svcA, svcB];

    const result = applyServiceTransfer(
      services,
      { serviceId: 'svc_A', parentServiceId: null, stageId: null, packageId: 'svc_A_pkg1', minutes: 60 },
      { serviceId: 'svc_B', parentServiceId: null, stageId: null, packageId: 'svc_B_pkg1', minutes: 120 }
    );

    expect(result).not.toBeNull();
    const updatedA = result.updatedServices.find(s => s.id === 'svc_A');
    const updatedB = result.updatedServices.find(s => s.id === 'svc_B');

    // svc_A: was 5h, minus 1h = 4h
    expect(updatedA.hoursUsed).toBe(4);
    // svc_B: was 0h, plus 2h = 2h
    expect(updatedB.hoursUsed).toBe(2);
  });

  test('old service no longer exists: aborts transfer (returns null)', () => {
    // Only svc_B exists — svc_A was deleted
    const svcB = makeHoursService('svc_B', { totalHours: 20, hoursUsed: 0 });
    const services = [svcB];

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = applyServiceTransfer(
      services,
      { serviceId: 'svc_A', parentServiceId: null, stageId: null, packageId: 'svc_A_pkg1', minutes: 60 },
      { serviceId: 'svc_B', parentServiceId: null, stageId: null, packageId: 'svc_B_pkg1', minutes: 60 }
    );

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('old service svc_A not found'));

    consoleSpy.mockRestore();
  });

  test('new service not found: returns null', () => {
    const svcA = makeHoursService('svc_A', { totalHours: 20, hoursUsed: 5 });
    const services = [svcA]; // svc_B doesn't exist

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = applyServiceTransfer(
      services,
      { serviceId: 'svc_A', parentServiceId: null, stageId: null, packageId: 'svc_A_pkg1', minutes: 60 },
      { serviceId: 'svc_B', parentServiceId: null, stageId: null, packageId: 'svc_B_pkg1', minutes: 60 }
    );

    expect(result).toBeNull();
    consoleSpy.mockRestore();
  });

  test('old service exists but package not found: aborts transfer (returns null)', () => {
    const svcA = makeHoursService('svc_A', { totalHours: 20, hoursUsed: 5 });
    const svcB = makeHoursService('svc_B', { totalHours: 20, hoursUsed: 0 });
    const services = [svcA, svcB];

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // packageId 'wrong_pkg' does not exist in svc_A
    const result = applyServiceTransfer(
      services,
      { serviceId: 'svc_A', parentServiceId: null, stageId: null, packageId: 'wrong_pkg', minutes: 60 },
      { serviceId: 'svc_B', parentServiceId: null, stageId: null, packageId: 'svc_B_pkg1', minutes: 60 }
    );

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('aborting transfer'));
    consoleSpy.mockRestore();
  });

  test('cross-type transfer: hours → legal_procedure', () => {
    const svcHours = makeHoursService('svc_hours', { totalHours: 20, hoursUsed: 5 });
    const svcLegal = makeLegalProcedureService('svc_legal');
    const services = [svcHours, svcLegal];

    const result = applyServiceTransfer(
      services,
      { serviceId: 'svc_hours', parentServiceId: null, stageId: null, packageId: 'svc_hours_pkg1', minutes: 60 },
      { serviceId: 'stage_a', parentServiceId: 'svc_legal', stageId: 'stage_a', packageId: 'stage_a_pkg1', minutes: 60 }
    );

    expect(result).not.toBeNull();
    const updatedHours = result.updatedServices.find(s => s.id === 'svc_hours');
    const updatedLegal = result.updatedServices.find(s => s.id === 'svc_legal');

    // Hours service: 5h - 1h = 4h
    expect(updatedHours.hoursUsed).toBe(4);
    // Legal procedure stage: 10h + 1h = 11h
    const stage = updatedLegal.stages.find(st => st.id === 'stage_a');
    expect(stage.packages[0].hoursUsed).toBe(11);
  });

  test('transfer preserves unrelated services', () => {
    const svcA = makeHoursService('svc_A', { totalHours: 20, hoursUsed: 5 });
    const svcB = makeHoursService('svc_B', { totalHours: 20, hoursUsed: 0 });
    const svcC = makeHoursService('svc_C', { totalHours: 10, hoursUsed: 3 });
    const services = [svcA, svcB, svcC];

    const result = applyServiceTransfer(
      services,
      { serviceId: 'svc_A', parentServiceId: null, stageId: null, packageId: 'svc_A_pkg1', minutes: 60 },
      { serviceId: 'svc_B', parentServiceId: null, stageId: null, packageId: 'svc_B_pkg1', minutes: 60 }
    );

    const updatedC = result.updatedServices.find(s => s.id === 'svc_C');
    expect(updatedC.hoursUsed).toBe(3); // unchanged
    expect(updatedC.hoursRemaining).toBe(7); // unchanged
  });
});


// ═══════════════════════════════════════════════════════════════
// Bugs B + E: isBlocked respects overrideActive / overdraftResolved
// ═══════════════════════════════════════════════════════════════

describe('Bugs B+E: isBlocked respects override flags', () => {

  describe('applyHoursDelta — service-level isBlocked', () => {
    test('depleted service WITHOUT overrides → isBlocked: true', () => {
      const svc = makeHoursService('svc_1', { totalHours: 1, hoursUsed: 0 });
      const services = [svc];

      // Add 60 min (1h) to fully deplete
      const result = applyHoursDelta(services, 'svc_1', 'svc_1_pkg1', 60);

      expect(result).not.toBeNull();
      const updated = result.updatedServices[0];
      expect(updated.hoursUsed).toBe(1);
      expect(updated.hoursRemaining).toBe(0);
      expect(updated.isBlocked).toBe(true);
    });

    test('depleted service WITH overrideActive → isBlocked: false', () => {
      const svc = makeHoursService('svc_1', { totalHours: 1, hoursUsed: 0, overrideActive: true });
      const services = [svc];

      const result = applyHoursDelta(services, 'svc_1', 'svc_1_pkg1', 60);

      expect(result).not.toBeNull();
      const updated = result.updatedServices[0];
      expect(updated.hoursUsed).toBe(1);
      expect(updated.hoursRemaining).toBe(0);
      expect(updated.isBlocked).toBe(false); // override prevents blocking
    });

    test('depleted service WITH overdraftResolved.isResolved → isBlocked: false', () => {
      const svc = makeHoursService('svc_1', {
        totalHours: 1,
        hoursUsed: 0,
        overdraftResolved: { isResolved: true, resolvedAt: '2026-03-20', resolvedBy: 'admin' }
      });
      const services = [svc];

      const result = applyHoursDelta(services, 'svc_1', 'svc_1_pkg1', 60);

      expect(result).not.toBeNull();
      const updated = result.updatedServices[0];
      expect(updated.hoursRemaining).toBe(0);
      expect(updated.isBlocked).toBe(false); // overdraftResolved prevents blocking
    });

    test('service with hours remaining → isBlocked: false regardless of flags', () => {
      const svc = makeHoursService('svc_1', { totalHours: 20, hoursUsed: 0, overrideActive: true });
      const services = [svc];

      const result = applyHoursDelta(services, 'svc_1', 'svc_1_pkg1', 60);

      const updated = result.updatedServices[0];
      expect(updated.hoursRemaining).toBe(19);
      expect(updated.isBlocked).toBe(false);
    });
  });

  describe('applyHoursDeltaServiceOnly — service-level isBlocked', () => {
    test('depleted with overrideActive → isBlocked: false', () => {
      const svc = {
        id: 'svc_1',
        type: 'hours',
        totalHours: 1,
        hoursUsed: 0,
        hoursRemaining: 1,
        overrideActive: true,
        packages: []
      };
      const services = [svc];

      const result = applyHoursDeltaServiceOnly(services, 'svc_1', 60);
      const updated = result.updatedServices[0];
      expect(updated.hoursRemaining).toBe(0);
      expect(updated.isBlocked).toBe(false);
    });
  });

  describe('calcClientAggregates — client-level isBlocked', () => {
    test('all services depleted, no overrides → isBlocked: true', () => {
      const services = [
        makeHoursService('svc_1', { totalHours: 10, hoursUsed: 10 })
      ];
      const agg = calcClientAggregates(services, 10);
      expect(agg.isBlocked).toBe(true);
      expect(agg.hoursRemaining).toBe(0);
    });

    test('all services depleted, one has overrideActive → isBlocked: false', () => {
      const services = [
        makeHoursService('svc_1', { totalHours: 10, hoursUsed: 10, overrideActive: true })
      ];
      const agg = calcClientAggregates(services, 10);
      expect(agg.isBlocked).toBe(false);
    });

    test('all services depleted, one has overdraftResolved → isBlocked: false', () => {
      const services = [
        makeHoursService('svc_1', {
          totalHours: 10,
          hoursUsed: 10,
          overdraftResolved: { isResolved: true }
        })
      ];
      const agg = calcClientAggregates(services, 10);
      expect(agg.isBlocked).toBe(false);
    });

    test('client still has hours → isBlocked: false (regression)', () => {
      const services = [
        makeHoursService('svc_1', { totalHours: 10, hoursUsed: 5 })
      ];
      const agg = calcClientAggregates(services, 10);
      expect(agg.isBlocked).toBe(false);
      expect(agg.hoursRemaining).toBe(5);
    });

    test('isCritical: hours > 0 and <= 5 → true', () => {
      const services = [
        makeHoursService('svc_1', { totalHours: 10, hoursUsed: 7 })
      ];
      const agg = calcClientAggregates(services, 10);
      expect(agg.isBlocked).toBe(false);
      expect(agg.isCritical).toBe(true);
      expect(agg.hoursRemaining).toBe(3);
    });

    test('fixed legal_procedure services excluded from billing', () => {
      const services = [
        {
          id: 'svc_fixed',
          type: 'legal_procedure',
          pricingType: 'fixed',
          hoursUsed: 100,
          hoursRemaining: null
        },
        makeHoursService('svc_hours', { totalHours: 10, hoursUsed: 3 })
      ];
      const agg = calcClientAggregates(services, 10);
      // Only svc_hours is billable
      expect(agg.hoursUsed).toBe(3);
      expect(agg.hoursRemaining).toBe(7);
      expect(agg.isBlocked).toBe(false);
    });

    test('multiple services: one depleted no override, one with override → isBlocked: false', () => {
      const services = [
        makeHoursService('svc_1', { totalHours: 5, hoursUsed: 5 }),
        makeHoursService('svc_2', { totalHours: 5, hoursUsed: 5, overrideActive: true })
      ];
      // clientTotalHours = 10, total hoursUsed = 10 → hoursRemaining = 0
      const agg = calcClientAggregates(services, 10);
      expect(agg.hoursRemaining).toBe(0);
      // But svc_2 has overrideActive, so client is NOT blocked
      expect(agg.isBlocked).toBe(false);
    });
  });
});


// ═══════════════════════════════════════════════════════════════
// Regression: normal applyHoursDelta behavior
// ═══════════════════════════════════════════════════════════════

describe('Regression: applyHoursDelta normal behavior', () => {
  test('CREATE: adds hours to package', () => {
    const svc = makeHoursService('svc_1', { totalHours: 20, hoursUsed: 5 });
    const result = applyHoursDelta([svc], 'svc_1', 'svc_1_pkg1', 60);

    expect(result).not.toBeNull();
    const updated = result.updatedServices[0];
    expect(updated.hoursUsed).toBe(6);
    expect(updated.hoursRemaining).toBe(14);
    expect(updated.packages[0].hoursUsed).toBe(6);
    expect(updated.packages[0].hoursRemaining).toBe(14);
    expect(updated.packages[0].status).toBe('active');
  });

  test('DELETE: subtracts hours from package', () => {
    const svc = makeHoursService('svc_1', { totalHours: 20, hoursUsed: 5 });
    const result = applyHoursDelta([svc], 'svc_1', 'svc_1_pkg1', -60);

    const updated = result.updatedServices[0];
    expect(updated.hoursUsed).toBe(4);
    expect(updated.hoursRemaining).toBe(16);
  });

  test('overage: hoursRemaining goes negative → isOverage=true', () => {
    const svc = makeHoursService('svc_1', { totalHours: 1, hoursUsed: 0.5 });
    // Adding 60 min (1h) when only 0.5h remaining
    const result = applyHoursDelta([svc], 'svc_1', 'svc_1_pkg1', 60);

    expect(result.isOverage).toBe(true);
    expect(result.overageMinutes).toBeGreaterThan(0);
    const updated = result.updatedServices[0];
    expect(updated.packages[0].status).toBe('depleted');
  });

  test('target not found → returns null', () => {
    const svc = makeHoursService('svc_1');
    const result = applyHoursDelta([svc], 'svc_1', 'wrong_pkg_id', 60);
    expect(result).toBeNull();
  });

  test('wrong service ID → returns null', () => {
    const svc = makeHoursService('svc_1');
    const result = applyHoursDelta([svc], 'svc_wrong', 'svc_1_pkg1', 60);
    expect(result).toBeNull();
  });
});


// ═══════════════════════════════════════════════════════════════
// Regression: applyLegalProcedureDelta normal behavior
// ═══════════════════════════════════════════════════════════════

describe('Regression: applyLegalProcedureDelta', () => {
  test('adds hours to hourly stage package', () => {
    const svc = makeLegalProcedureService('svc_legal');
    const result = applyLegalProcedureDelta([svc], 'svc_legal', 'stage_a', 'stage_a_pkg1', 120);

    expect(result).not.toBeNull();
    const stage = result.updatedServices[0].stages[0];
    expect(stage.packages[0].hoursUsed).toBe(12); // was 10 + 2h
    expect(stage.packages[0].hoursRemaining).toBe(18);
  });

  test('fixed stage: only updates totalHoursWorked', () => {
    const svc = makeLegalProcedureService('svc_legal', {
      stages: [
        { id: 'stage_fixed', pricingType: 'fixed', totalHoursWorked: 5 }
      ]
    });
    const result = applyLegalProcedureDelta([svc], 'svc_legal', 'stage_fixed', null, 60);

    expect(result).not.toBeNull();
    const stage = result.updatedServices[0].stages[0];
    expect(stage.totalHoursWorked).toBe(6); // was 5 + 1h
  });
});
