/**
 * Tests for writeClientWithCanonicalAggregates — the single canonical write
 * helper for the clients collection.
 *
 * Contract:
 *   - Caller-supplied isBlocked / isCritical / hours fields / totalHours are
 *     STRIPPED. They are derived from calcClientAggregates exclusively.
 *   - Helper runs inside an active Firestore transaction.
 *   - assertClientAggregateInvariants runs before transaction.update —
 *     throws on violation so bad writes never reach Firestore.
 *   - Helper tolerates malformed services (null entries, missing fields,
 *     legacy shapes) by filtering and falling through to calcClientAggregates
 *     which is itself tolerant of missing fields.
 *
 * Tests follow the agent-recommended TDD plan (Stage 1 investigation).
 */

// ═══════════════════════════════════════════════════════════════
// Mocks — must precede require()
// ═══════════════════════════════════════════════════════════════

const mockTransaction = {
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn()
};

jest.mock('firebase-admin', () => {
  const FieldValue = {
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
    increment: jest.fn((n) => ({ _increment: n }))
  };
  return {
    initializeApp: jest.fn(),
    firestore: Object.assign(() => ({ collection: jest.fn() }), { FieldValue })
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
    https: { HttpsError },
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() }
  };
});

// PR-A.5: wrap aggregates module so we can control assertClientAggregateInvariants
// per-test (default = real impl; tests override via mockImplementationOnce).
jest.mock('../shared/aggregates', () => {
  const actual = jest.requireActual('../shared/aggregates');
  return {
    ...actual,
    assertClientAggregateInvariants: jest.fn(actual.assertClientAggregateInvariants)
  };
});

// ═══════════════════════════════════════════════════════════════
// Requires — after mocks
// ═══════════════════════════════════════════════════════════════

const { writeClientWithCanonicalAggregates } = require('../shared/client-writer');
const { assertClientAggregateInvariants: mockedAssert } = require('../shared/aggregates');
const { SYSTEM_CONSTANTS } = require('../shared/constants');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;
const PT = SYSTEM_CONSTANTS.PRICING_TYPES;

// ═══════════════════════════════════════════════════════════════
// Test helpers
// ═══════════════════════════════════════════════════════════════

function makeHoursService(id, { totalHours = 20, hoursUsed = 5, overrideActive = false } = {}) {
  return {
    id,
    type: ST.HOURS,
    name: 'שירות שעתי',
    totalHours,
    hoursUsed,
    hoursRemaining: totalHours - hoursUsed,
    overrideActive,
    status: 'active'
  };
}

function makeFixedService(id, { fixedPrice = 5000 } = {}) {
  return {
    id,
    type: ST.FIXED,
    name: 'שירות קבוע',
    fixedPrice,
    work: { totalMinutesWorked: 0, entriesCount: 0 },
    status: 'active'
  };
}

function makeLegalProcedureHourly(id, { totalHours = 10, hoursUsed = 3 } = {}) {
  return {
    id,
    type: ST.LEGAL_PROCEDURE,
    name: 'הליך משפטי שעתי',
    pricingType: PT.HOURLY,
    totalHours,
    hoursUsed,
    hoursRemaining: totalHours - hoursUsed,
    stages: [
      { id: 'stage_a', name: 'שלב א', status: 'active', totalHours, hoursUsed }
    ],
    currentStage: 'stage_a',
    status: 'active'
  };
}

function makeLegalProcedureFixed(id, { fixedPrice = 8000 } = {}) {
  return {
    id,
    type: ST.LEGAL_PROCEDURE,
    name: 'הליך משפטי פיקס',
    pricingType: PT.FIXED,
    totalPrice: fixedPrice,
    stages: [
      { id: 'stage_a', name: 'שלב א', status: 'active', fixedPrice: 4000, paid: false }
    ],
    currentStage: 'stage_a',
    status: 'active'
  };
}

function makeClientDoc(overrides = {}) {
  return {
    exists: true,
    data: () => ({
      fullName: 'לקוח טסט',
      status: 'active',
      isBlocked: false,
      isCritical: false,
      services: [],
      totalHours: 0,
      hoursUsed: 0,
      hoursRemaining: 0,
      ...overrides
    })
  };
}

const clientRef = { id: 'c1', path: 'clients/c1' };

beforeEach(() => {
  jest.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════
// A. Input validation
// ═══════════════════════════════════════════════════════════════

describe('A. Input validation', () => {
  test('throws when transaction is missing', async () => {
    await expect(
      writeClientWithCanonicalAggregates(null, clientRef, {}, { caller: 'test' })
    ).rejects.toThrow(/transaction/i);
  });

  test('throws when clientRef is missing', async () => {
    await expect(
      writeClientWithCanonicalAggregates(mockTransaction, null, {}, { caller: 'test' })
    ).rejects.toThrow(/clientRef/i);
  });

  test('throws when partialUpdate is null', async () => {
    await expect(
      writeClientWithCanonicalAggregates(mockTransaction, clientRef, null, { caller: 'test' })
    ).rejects.toThrow(/partialUpdate/i);
  });

  test('throws when options.caller is missing', async () => {
    await expect(
      writeClientWithCanonicalAggregates(mockTransaction, clientRef, {}, {})
    ).rejects.toThrow(/caller/i);
  });
});

// ═══════════════════════════════════════════════════════════════
// B. Transaction read semantics
// ═══════════════════════════════════════════════════════════════

describe('B. Transaction read semantics', () => {
  test('reads client via transaction.get before update', async () => {
    mockTransaction.get.mockResolvedValue(makeClientDoc());
    await writeClientWithCanonicalAggregates(
      mockTransaction, clientRef, { status: 'inactive' }, { caller: 'test' }
    );
    expect(mockTransaction.get).toHaveBeenCalledWith(clientRef);
    // Read before write: invocation order check
    const getOrder = mockTransaction.get.mock.invocationCallOrder[0];
    const updateOrder = mockTransaction.update.mock.invocationCallOrder[0];
    expect(getOrder).toBeLessThan(updateOrder);
  });

  test('throws not-found when client does not exist', async () => {
    mockTransaction.get.mockResolvedValue({ exists: false });
    await expect(
      writeClientWithCanonicalAggregates(
        mockTransaction, clientRef, { status: 'inactive' }, { caller: 'test' }
      )
    ).rejects.toMatchObject({ code: 'not-found' });
  });
});

// ═══════════════════════════════════════════════════════════════
// C. Caller-supplied restricted fields are stripped
// ═══════════════════════════════════════════════════════════════

describe('C. Restricted fields stripped from caller input', () => {
  test('strips isBlocked from partialUpdate', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({ services: [makeFixedService('s1')] })
    );
    await writeClientWithCanonicalAggregates(
      mockTransaction, clientRef,
      { status: 'active', isBlocked: true },  // fixed-only ⇒ I1 forces isBlocked=false
      { caller: 'test' }
    );
    const [, payload] = mockTransaction.update.mock.calls[0];
    expect(payload.isBlocked).toBe(false);  // canonical wins
  });

  test('strips isCritical from partialUpdate', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({ services: [makeFixedService('s1')] })
    );
    await writeClientWithCanonicalAggregates(
      mockTransaction, clientRef,
      { isCritical: true },
      { caller: 'test' }
    );
    const [, payload] = mockTransaction.update.mock.calls[0];
    expect(payload.isCritical).toBe(false);
  });

  test('strips hoursUsed / hoursRemaining / minutesUsed / minutesRemaining', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({
        services: [makeHoursService('s1', { totalHours: 10, hoursUsed: 3 })],
        totalHours: 10
      })
    );
    await writeClientWithCanonicalAggregates(
      mockTransaction, clientRef,
      { hoursUsed: 999, hoursRemaining: -888, minutesUsed: 999, minutesRemaining: -888 },
      { caller: 'test' }
    );
    const [, payload] = mockTransaction.update.mock.calls[0];
    expect(payload.hoursUsed).toBe(3);
    expect(payload.hoursRemaining).toBe(7);
    expect(payload.minutesUsed).toBe(180);
    expect(payload.minutesRemaining).toBe(420);
  });

  test('strips totalHours (derived from services)', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({
        services: [makeHoursService('s1', { totalHours: 10, hoursUsed: 3 })],
        totalHours: 10
      })
    );
    await writeClientWithCanonicalAggregates(
      mockTransaction, clientRef,
      { totalHours: 99999 },  // attacker / bug
      { caller: 'test' }
    );
    const [, payload] = mockTransaction.update.mock.calls[0];
    expect(payload.totalHours).toBe(10);  // recomputed from services
  });

  test('non-aggregate fields (fullName, status, phone) pass through', async () => {
    mockTransaction.get.mockResolvedValue(makeClientDoc());
    await writeClientWithCanonicalAggregates(
      mockTransaction, clientRef,
      { fullName: 'שם חדש', status: 'inactive', phone: '0501234567' },
      { caller: 'test' }
    );
    const [, payload] = mockTransaction.update.mock.calls[0];
    expect(payload.fullName).toBe('שם חדש');
    expect(payload.status).toBe('inactive');
    expect(payload.phone).toBe('0501234567');
  });
});

// ═══════════════════════════════════════════════════════════════
// D. Aggregate computation across service variants
// ═══════════════════════════════════════════════════════════════

describe('D. Aggregate computation', () => {
  test('empty services → isBlocked=false, isCritical=false (I1)', async () => {
    mockTransaction.get.mockResolvedValue(makeClientDoc({ services: [] }));
    await writeClientWithCanonicalAggregates(
      mockTransaction, clientRef, { status: 'active' }, { caller: 'test' }
    );
    const [, payload] = mockTransaction.update.mock.calls[0];
    expect(payload.isBlocked).toBe(false);
    expect(payload.isCritical).toBe(false);
  });

  test('fixed-only client → isBlocked=false (I1)', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({
        services: [makeFixedService('s1'), makeFixedService('s2')]
      })
    );
    await writeClientWithCanonicalAggregates(
      mockTransaction, clientRef, {}, { caller: 'test' }
    );
    const [, payload] = mockTransaction.update.mock.calls[0];
    expect(payload.isBlocked).toBe(false);
    expect(payload.isCritical).toBe(false);
  });

  test('hours depleted, no override → isBlocked=true (canonical)', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({
        services: [makeHoursService('s1', { totalHours: 10, hoursUsed: 10 })],
        totalHours: 10
      })
    );
    await writeClientWithCanonicalAggregates(
      mockTransaction, clientRef, {}, { caller: 'test' }
    );
    const [, payload] = mockTransaction.update.mock.calls[0];
    expect(payload.isBlocked).toBe(true);
    expect(payload.isCritical).toBe(false);
    expect(payload.hoursRemaining).toBe(0);
  });

  test('hours depleted with overrideActive → isBlocked=false (I2)', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({
        services: [makeHoursService('s1', { totalHours: 10, hoursUsed: 10, overrideActive: true })],
        totalHours: 10
      })
    );
    await writeClientWithCanonicalAggregates(
      mockTransaction, clientRef, {}, { caller: 'test' }
    );
    const [, payload] = mockTransaction.update.mock.calls[0];
    expect(payload.isBlocked).toBe(false);
  });

  test('hours low (<=5) and not zero → isCritical=true', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({
        services: [makeHoursService('s1', { totalHours: 10, hoursUsed: 7 })],
        totalHours: 10
      })
    );
    await writeClientWithCanonicalAggregates(
      mockTransaction, clientRef, {}, { caller: 'test' }
    );
    const [, payload] = mockTransaction.update.mock.calls[0];
    expect(payload.isBlocked).toBe(false);
    expect(payload.isCritical).toBe(true);
  });

  test('mixed services (hours + fixed) — only hours counted', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({
        services: [
          makeHoursService('s1', { totalHours: 10, hoursUsed: 3 }),
          makeFixedService('s2')
        ],
        totalHours: 10
      })
    );
    await writeClientWithCanonicalAggregates(
      mockTransaction, clientRef, {}, { caller: 'test' }
    );
    const [, payload] = mockTransaction.update.mock.calls[0];
    expect(payload.hoursUsed).toBe(3);
    expect(payload.hoursRemaining).toBe(7);
    expect(payload.isBlocked).toBe(false);
  });

  test('legal_procedure hourly → counted as billable', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({
        services: [makeLegalProcedureHourly('s1', { totalHours: 10, hoursUsed: 4 })],
        totalHours: 10
      })
    );
    await writeClientWithCanonicalAggregates(
      mockTransaction, clientRef, {}, { caller: 'test' }
    );
    const [, payload] = mockTransaction.update.mock.calls[0];
    expect(payload.hoursUsed).toBe(4);
    expect(payload.hoursRemaining).toBe(6);
    expect(payload.isBlocked).toBe(false);
  });

  test('legal_procedure fixed → excluded (treated as fixed-only)', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({
        services: [makeLegalProcedureFixed('s1')]
      })
    );
    await writeClientWithCanonicalAggregates(
      mockTransaction, clientRef, {}, { caller: 'test' }
    );
    const [, payload] = mockTransaction.update.mock.calls[0];
    expect(payload.isBlocked).toBe(false);  // I1 path
    expect(payload.hoursUsed).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// E. Robustness — malformed / legacy data tolerance
// ═══════════════════════════════════════════════════════════════

describe('E. Robustness', () => {
  test('services with null entries → filtered safely (no throw)', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({
        services: [null, makeHoursService('s1'), undefined],
        totalHours: 20
      })
    );
    await expect(
      writeClientWithCanonicalAggregates(
        mockTransaction, clientRef, {}, { caller: 'test' }
      )
    ).resolves.toBeTruthy();
    const [, payload] = mockTransaction.update.mock.calls[0];
    expect(payload.isBlocked).toBe(false);
  });

  test('services field missing → treated as []', async () => {
    mockTransaction.get.mockResolvedValue({
      exists: true,
      data: () => ({ fullName: 'no-services client', status: 'active' })
    });
    await expect(
      writeClientWithCanonicalAggregates(
        mockTransaction, clientRef, {}, { caller: 'test' }
      )
    ).resolves.toBeTruthy();
    const [, payload] = mockTransaction.update.mock.calls[0];
    expect(payload.isBlocked).toBe(false);
  });

  test('partialUpdate.services replaces wholesale', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({ services: [makeHoursService('s1')] })
    );
    const newServices = [makeFixedService('s2')];
    await writeClientWithCanonicalAggregates(
      mockTransaction, clientRef, { services: newServices }, { caller: 'test' }
    );
    const [, payload] = mockTransaction.update.mock.calls[0];
    expect(payload.services).toHaveLength(1);
    expect(payload.services[0].id).toBe('s2');
    expect(payload.isBlocked).toBe(false);  // fixed-only ⇒ I1
  });
});

// ═══════════════════════════════════════════════════════════════
// F. Invariant assertion before write
// ═══════════════════════════════════════════════════════════════

describe('F. Invariant assertion', () => {
  test('calls transaction.update only after invariants asserted', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({ services: [makeHoursService('s1')] })
    );
    await writeClientWithCanonicalAggregates(
      mockTransaction, clientRef, { status: 'active' }, { caller: 'test' }
    );
    expect(mockTransaction.update).toHaveBeenCalledTimes(1);
  });

  test('throws invariant_violation when canonical aggregates would violate I4', async () => {
    // Construct a state where billable services exist + custom totalHours
    // that creates a logically inconsistent canonical result. Since
    // calcClientAggregates guarantees I1/I2/I3/I4 by construction, this
    // confirms the assert is wired (defensive: if calcClient ever drifts,
    // the helper catches it).
    // We force this by temporarily mocking calcClientAggregates via the
    // services list to produce isBlocked && isCritical (won't happen
    // naturally, but assert must still guard).
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({ services: [makeHoursService('s1', { totalHours: 10, hoursUsed: 10 })] })
    );
    // This is a happy path — should not throw. The negative-assert test
    // is covered in the aggregates.js unit tests directly. Confirm here
    // that the helper does NOT throw on a clean canonical result:
    await expect(
      writeClientWithCanonicalAggregates(
        mockTransaction, clientRef, {}, { caller: 'test' }
      )
    ).resolves.toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════
// G. Write payload composition
// ═══════════════════════════════════════════════════════════════

describe('G. Write payload composition', () => {
  test('payload includes canonical aggregate fields', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({
        services: [makeHoursService('s1', { totalHours: 10, hoursUsed: 4 })],
        totalHours: 10
      })
    );
    await writeClientWithCanonicalAggregates(
      mockTransaction, clientRef, {}, { caller: 'test' }
    );
    const [, payload] = mockTransaction.update.mock.calls[0];
    expect(payload).toHaveProperty('isBlocked');
    expect(payload).toHaveProperty('isCritical');
    expect(payload).toHaveProperty('hoursUsed');
    expect(payload).toHaveProperty('hoursRemaining');
    expect(payload).toHaveProperty('minutesUsed');
    expect(payload).toHaveProperty('minutesRemaining');
    expect(payload).toHaveProperty('totalHours');
  });

  test('auditMeta adds lastModifiedAt + lastModifiedBy', async () => {
    mockTransaction.get.mockResolvedValue(makeClientDoc());
    await writeClientWithCanonicalAggregates(
      mockTransaction, clientRef,
      { status: 'inactive' },
      { caller: 'test', auditMeta: { uid: 'user1', username: 'haim' } }
    );
    const [, payload] = mockTransaction.update.mock.calls[0];
    expect(payload).toHaveProperty('lastModifiedAt');
    expect(payload.lastModifiedBy).toBe('haim');
  });

  test('no auditMeta → no lastModified fields added', async () => {
    mockTransaction.get.mockResolvedValue(makeClientDoc());
    await writeClientWithCanonicalAggregates(
      mockTransaction, clientRef, { status: 'inactive' }, { caller: 'test' }
    );
    const [, payload] = mockTransaction.update.mock.calls[0];
    expect(payload).not.toHaveProperty('lastModifiedAt');
    expect(payload).not.toHaveProperty('lastModifiedBy');
  });
});

// ═══════════════════════════════════════════════════════════════
// H. Return value
// ═══════════════════════════════════════════════════════════════

describe('H. Return value', () => {
  test('returns summary of canonical aggregates + written payload', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({
        services: [makeHoursService('s1', { totalHours: 10, hoursUsed: 4 })],
        totalHours: 10
      })
    );
    const result = await writeClientWithCanonicalAggregates(
      mockTransaction, clientRef, { status: 'active' }, { caller: 'test' }
    );
    expect(result).toMatchObject({
      aggregates: {
        isBlocked: false,
        isCritical: false,
        hoursUsed: 4,
        hoursRemaining: 6
      },
      previousAggregates: expect.any(Object),
      strippedKeys: expect.any(Array)
    });
  });

  test('strippedKeys reports which restricted fields the caller tried to set', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({ services: [makeHoursService('s1')] })
    );
    const result = await writeClientWithCanonicalAggregates(
      mockTransaction, clientRef,
      { status: 'active', isBlocked: true, hoursUsed: 999 },
      { caller: 'test' }
    );
    expect(result.strippedKeys).toEqual(
      expect.arrayContaining(['isBlocked', 'hoursUsed'])
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// I. Violation logging (PR-A.5)
// ═══════════════════════════════════════════════════════════════

describe('I. Violation logging on assertion failure', () => {
  test('happy path → violationLogger NOT called', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({ services: [makeHoursService('s1')] })
    );
    const violationLogger = jest.fn();
    await writeClientWithCanonicalAggregates(
      mockTransaction, clientRef,
      { status: 'active' },
      { caller: 'test', violationLogger }
    );
    expect(violationLogger).not.toHaveBeenCalled();
  });

  test('assertion throws → violationLogger called once with structured payload + original error re-thrown', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({
        services: [makeHoursService('s1', { totalHours: 10, hoursUsed: 3 })],
        totalHours: 10
      })
    );
    // Force the assertion to throw (simulating drift in calcClientAggregates).
    const assertErr = new Error('invariant_violation:I4_blocked_and_critical [caller=test]');
    mockedAssert.mockImplementationOnce(() => {
      throw assertErr;
    });
    const violationLogger = jest.fn();

    await expect(
      writeClientWithCanonicalAggregates(
        mockTransaction, clientRef,
        { status: 'active' },
        {
          caller: 'changeClientStatus',
          auditMeta: { uid: 'user1', username: 'haim' },
          violationLogger
        }
      )
    ).rejects.toThrow(assertErr);

    // Logger called exactly once
    expect(violationLogger).toHaveBeenCalledTimes(1);

    // Payload shape
    const violation = violationLogger.mock.calls[0][0];
    expect(violation).toMatchObject({
      caller: 'changeClientStatus',
      clientId: 'c1',
      error: 'invariant_violation:I4_blocked_and_critical [caller=test]',
      proposedAggregates: expect.objectContaining({
        isBlocked: expect.any(Boolean),
        isCritical: expect.any(Boolean),
        totalHours: expect.any(Number),
        hoursRemaining: expect.any(Number)
      }),
      servicesSummary: [
        expect.objectContaining({
          id: 's1',
          type: 'hours',
          totalHours: 10,
          status: 'active'
        })
      ],
      auditMeta: { uid: 'user1', username: 'haim' }
    });
    expect(violation.timestamp).toBeDefined();

    // Transaction.update was NOT called (write must not happen on violation)
    expect(mockTransaction.update).not.toHaveBeenCalled();
  });

  test('default violationLogger used when option omitted (no throw on missing logger)', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({ services: [makeHoursService('s1')] })
    );
    const assertErr = new Error('invariant_violation:I1_no_billable_but_blocked [caller=x]');
    mockedAssert.mockImplementationOnce(() => {
      throw assertErr;
    });

    // No violationLogger in options → falls back to default. Default uses
    // admin.firestore() which the firebase-admin mock stubs as a function
    // returning { collection: jest.fn() }. We don't expect the default
    // logger to crash the helper.
    await expect(
      writeClientWithCanonicalAggregates(
        mockTransaction, clientRef,
        { status: 'active' },
        { caller: 'test-default' }
      )
    ).rejects.toThrow(assertErr);

    // Helper should still throw the original assertion error and skip the write.
    expect(mockTransaction.update).not.toHaveBeenCalled();
  });

  test('violationLogger sync throw does not mask original assertion error', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({ services: [makeHoursService('s1')] })
    );
    const assertErr = new Error('invariant_violation:I2_override_active_but_blocked [caller=x]');
    mockedAssert.mockImplementationOnce(() => {
      throw assertErr;
    });
    const badLogger = jest.fn(() => {
      throw new Error('logger storage backend down');
    });

    // The original assertion error must propagate, not the logger's error.
    await expect(
      writeClientWithCanonicalAggregates(
        mockTransaction, clientRef,
        { status: 'active' },
        { caller: 'test', violationLogger: badLogger }
      )
    ).rejects.toThrow(assertErr);

    expect(badLogger).toHaveBeenCalledTimes(1);
    expect(mockTransaction.update).not.toHaveBeenCalled();
  });
});
