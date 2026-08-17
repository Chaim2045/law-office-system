/**
 * PR-1 — `hoursCapacity` at its real call site in the canonical writer.
 *
 * THE PROPERTY THAT MATTERS MOST
 *
 * The capacity computation sits at step 7b of `writeClientWithCanonicalAggregates`
 * — OUTSIDE every kill switch. The try/catch and all three enforcement modes
 * (`enforce`/`log_only`/`disabled`) wrap ONLY the invariant assertion below it,
 * and the timesheet trigger's deliberate `mode:'log_only'` does not reach up
 * there. So if this computation could throw, a single malformed stage would
 * abort `createQuickLogEntry`, `addTimeToTask`, `moveToNextStage`, `closeCase`
 * and the trigger — an employee could not log 30 minutes, in every mode.
 *
 * These tests assert the write still lands, and the money aggregates are still
 * correct, when the capacity input is hostile.
 */

'use strict';

const mockUpdate = jest.fn();
const mockTransaction = { get: jest.fn(), set: jest.fn(), update: mockUpdate };

jest.mock('firebase-admin', () => {
  const FieldValue = { serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP') };
  const firestore = () => ({
    collection: jest.fn(() => ({ add: jest.fn().mockResolvedValue({ id: 'v1' }) }))
  });
  firestore.FieldValue = FieldValue;
  return { initializeApp: jest.fn(), firestore, apps: [{}] };
});

const mockLoggerError = jest.fn();
jest.mock('firebase-functions', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: mockLoggerError }
}));

jest.mock('../shared/enforcement-mode', () => ({
  getEnforcementMode: jest.fn().mockResolvedValue('disabled'),
  VALID_MODES: ['enforce', 'log_only', 'disabled']
}));

const { writeClientWithCanonicalAggregates } = require('../shared/client-writer');
const { SYSTEM_CONSTANTS } = require('../shared/constants');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;

const clientRef = { id: '2025994' };

function primeClient(services) {
  mockTransaction.get.mockReset();
  mockTransaction.get.mockResolvedValue({
    exists: true,
    updateTime: 'T1',
    data: () => ({ fullName: 'לקוח', services })
  });
}

/** The payload that would reach Firestore. */
function written() {
  expect(mockUpdate).toHaveBeenCalled();
  return mockUpdate.mock.calls[0][1];
}

const stage = (id, totalHours, status) => ({
  id, status, pricingType: 'hourly', totalHours, hoursUsed: 0, hoursRemaining: totalHours
});

const procedure = (stages, totalHours) => ({
  id: 'lp1', type: ST.LEGAL_PROCEDURE, pricingType: 'hourly', status: 'active',
  stages, totalHours, hoursUsed: 0, hoursRemaining: totalHours
});

beforeEach(() => jest.clearAllMocks());

describe('hoursCapacity is written alongside the existing figures', () => {
  test('the phantom is now visible in the document itself', async () => {
    const services = [procedure(
      [stage('stage_a', 100, 'active'), stage('stage_b', 200, 'pending')],
      300
    )];
    primeClient(services);

    await writeClientWithCanonicalAggregates(
      mockTransaction, clientRef, { status: 'active' }, { caller: 'test' }
    );

    const payload = written();

    // The existing contract figure is UNCHANGED — H.3's Plan depends on it.
    expect(payload.totalHours).toBe(300);

    // And the honest figure sits beside it, with provenance.
    expect(payload.hoursCapacity).toMatchObject({
      activeHours: 100,
      contractHours: 300,
      phantomHours: 200,
      rule: 'active_stage_on_hours_accepting_service',
      ruleVersion: 1
    });
  });

  test('phase 1 is display-only: hoursRemaining and isBlocked are untouched by capacity', async () => {
    // The numerator/denominator constraint. `hoursUsed` also sums ALL stages,
    // so feeding activeHours into hoursRemaining without an equally
    // stage-filtered denominator would drive every client past stage A
    // negative and block them. That pairing is PR-5, not this PR.
    const services = [procedure(
      [stage('stage_a', 10, 'active'), stage('stage_b', 90, 'pending')],
      100
    )];
    services[0].hoursUsed = 40; // more than the active stage holds
    primeClient(services);

    await writeClientWithCanonicalAggregates(
      mockTransaction, clientRef, {}, { caller: 'test' }
    );

    const payload = written();
    expect(payload.hoursCapacity.activeHours).toBe(10);
    // Still derived from the CONTRACT figure — 100 - 40, not 10 - 40.
    expect(payload.hoursRemaining).toBe(60);
    expect(payload.isBlocked).toBe(false);
  });

  test('callers cannot inject the field — it is stripped and recomputed', async () => {
    primeClient([procedure([stage('stage_a', 50, 'active')], 50)]);

    const result = await writeClientWithCanonicalAggregates(
      mockTransaction, clientRef,
      { hoursCapacity: { activeHours: 99999, phantomHours: -1 } },
      { caller: 'test' }
    );

    expect(result.strippedKeys).toContain('hoursCapacity');
    expect(written().hoursCapacity.activeHours).toBe(50);
  });
});

describe('FAIL-OPEN — a display field can never block a billing write', () => {
  test('hostile stage data still commits, with correct money aggregates', async () => {
    const services = [{
      id: 'lp1', type: ST.LEGAL_PROCEDURE, pricingType: 'hourly', status: 'active',
      totalHours: 100, hoursUsed: 25, hoursRemaining: 75,
      stages: [null, undefined, 'garbage', 42, { status: 'active', totalHours: {} }]
    }];
    primeClient(services);

    await expect(
      writeClientWithCanonicalAggregates(
        mockTransaction, clientRef, {}, { caller: 'timesheet-trigger' }
      )
    ).resolves.toBeDefined();

    const payload = written();
    // The money numbers — the ones an employee's time entry depends on.
    expect(payload.totalHours).toBe(100);
    expect(payload.hoursUsed).toBe(25);
    expect(payload.hoursRemaining).toBe(75);
    // Capacity degraded to a finite number rather than poisoning the write.
    expect(Number.isFinite(payload.hoursCapacity.activeHours)).toBe(true);
  });

  test('if the computation itself threw, the write still lands and the field is omitted', async () => {
    // Simulate the unreachable case: force the module to throw, and assert the
    // wrapper absorbs it. This is the guarantee the whole design rests on.
    jest.resetModules();
    jest.doMock('../shared/stage-capacity', () => ({
      computeClientCapacity: () => { throw new Error('simulated capacity failure'); }
    }));

    const freshUpdate = jest.fn();
    const freshTx = {
      get: jest.fn().mockResolvedValue({
        exists: true, updateTime: 'T1',
        data: () => ({ fullName: 'לקוח', services: [procedure([stage('stage_a', 10, 'active')], 10)] })
      }),
      set: jest.fn(),
      update: freshUpdate
    };

    const { writeClientWithCanonicalAggregates: freshWriter } =
      require('../shared/client-writer');

    await expect(
      freshWriter(freshTx, clientRef, {}, { caller: 'test' })
    ).resolves.toBeDefined();

    expect(freshUpdate).toHaveBeenCalled();
    const payload = freshUpdate.mock.calls[0][1];

    // The write completed WITHOUT the field, rather than aborting.
    expect(payload.hoursCapacity).toBeUndefined();
    expect(payload.totalHours).toBe(10);

    jest.dontMock('../shared/stage-capacity');
    jest.resetModules();
  });
});
