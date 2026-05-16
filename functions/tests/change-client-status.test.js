/**
 * Tests for `changeClientStatus` CF (functions/clients/index.js).
 *
 * Updated for PR-A.4 (2026-05-16). The CF now:
 *   - Rejects caller-supplied `isBlocked` / `isCritical` (derived fields)
 *   - Accepts `isOnHold` as the manual freeze flag
 *   - Routes writes through writeClientWithCanonicalAggregates helper
 *
 * Coverage:
 *  A. Authentication
 *  B. clientId validation
 *  C. newStatus validation
 *  D. Rejection of derived-field inputs (PR-A.4 BREAKING)
 *  E. isOnHold acceptance + inactive-disallowed constraint
 *  F. Client not-found
 *  G. Same-state guard (status + isOnHold only)
 *  H. Successful write through canonical helper
 *  I. Audit log includes isOnHold + derived isBlocked/isCritical
 *  J. Return value structure
 *  K. Invariant bypass defense — caller sneaking aggregate fields is blocked
 *
 * Note on prior CONTRACT-CHANGED-IN-PR-A markers (from PR-A.1):
 *   - D (mutual exclusion of isBlocked+isCritical): replaced by D (rejection
 *     of both as input).
 *   - E (inactive disallows isBlocked/isCritical): replaced by E (inactive
 *     disallows isOnHold).
 *   - G (same-state guard on 3 fields): replaced by G (same-state on 2
 *     fields — status + isOnHold).
 *   - H (transitions writing isBlocked/isCritical): replaced by H (transitions
 *     writing isOnHold + canonical derived values via helper).
 *
 * No tests deleted — all migrated.
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
  collection: jest.fn(() => ({
    doc: jest.fn((id) => ({ id: id || 'auto_id' }))
  })),
  runTransaction: mockRunTransaction
};

jest.mock('firebase-admin', () => {
  const FieldValue = {
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
    increment: jest.fn((n) => ({ _increment: n }))
  };
  return {
    initializeApp: jest.fn(),
    firestore: Object.assign(() => mockDb, { FieldValue }),
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

const mockCheckUserPermissions = jest.fn();
jest.mock('../shared/auth', () => ({
  checkUserPermissions: mockCheckUserPermissions
}));

const mockLogAction = jest.fn();
jest.mock('../shared/audit', () => ({
  logAction: mockLogAction
}));

jest.mock('../shared/validators', () => ({
  sanitizeString: jest.fn((s) => s),
  isValidIsraeliPhone: jest.fn(() => true),
  isValidEmail: jest.fn(() => true)
}));

jest.mock('../case-number-transaction', () => ({
  generateCaseNumberWithTransaction: jest.fn(() => 'AUTO-2026000')
}));

// ═══════════════════════════════════════════════════════════════
// Requires — after mocks
// ═══════════════════════════════════════════════════════════════

const { changeClientStatus } = require('../clients/index');
const { SYSTEM_CONSTANTS } = require('../shared/constants');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;

// ═══════════════════════════════════════════════════════════════
// Test helpers
// ═══════════════════════════════════════════════════════════════

function makeHoursService(id, { totalHours = 20, hoursUsed = 5 } = {}) {
  return {
    id,
    type: ST.HOURS,
    name: 'שירות שעתי',
    totalHours,
    hoursUsed,
    hoursRemaining: totalHours - hoursUsed,
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

function makeClientDoc(overrides = {}) {
  return {
    exists: true,
    data: () => ({
      fullName: 'לקוח טסט',
      status: 'active',
      isBlocked: false,
      isCritical: false,
      isOnHold: false,
      services: [],
      totalHours: 0,
      hoursUsed: 0,
      hoursRemaining: 0,
      ...overrides
    })
  };
}

function makeCtx(uid = 'user1') {
  return { auth: { uid, token: { email: 'test@test.com', role: 'manager' } } };
}

const VALID_USER = {
  uid: 'user1',
  email: 'test@test.com',
  username: 'testuser',
  role: 'manager'
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCheckUserPermissions.mockResolvedValue(VALID_USER);
});

// ═══════════════════════════════════════════════════════════════
// A. Authentication
// ═══════════════════════════════════════════════════════════════

describe('A. Authentication', () => {
  test('propagates HttpsError from checkUserPermissions', async () => {
    const functions = require('firebase-functions');
    mockCheckUserPermissions.mockRejectedValue(
      new functions.https.HttpsError('unauthenticated', 'אין הרשאה')
    );
    await expect(
      changeClientStatus({ clientId: 'c1', newStatus: 'active' }, makeCtx())
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });
});

// ═══════════════════════════════════════════════════════════════
// B. clientId validation
// ═══════════════════════════════════════════════════════════════

describe('B. clientId validation', () => {
  test('throws invalid-argument when clientId is missing', async () => {
    await expect(
      changeClientStatus({ newStatus: 'active' }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('throws invalid-argument when clientId is non-string', async () => {
    await expect(
      changeClientStatus({ clientId: 123, newStatus: 'active' }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('throws invalid-argument when clientId is empty string', async () => {
    await expect(
      changeClientStatus({ clientId: '', newStatus: 'active' }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});

// ═══════════════════════════════════════════════════════════════
// C. newStatus validation
// ═══════════════════════════════════════════════════════════════

describe('C. newStatus validation', () => {
  test('throws invalid-argument when newStatus is missing', async () => {
    await expect(
      changeClientStatus({ clientId: 'c1' }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('throws invalid-argument for invalid newStatus value', async () => {
    await expect(
      changeClientStatus({ clientId: 'c1', newStatus: 'archived' }, makeCtx())
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('accepts newStatus="active"', async () => {
    mockTransaction.get.mockResolvedValue(makeClientDoc({ status: 'inactive' }));
    await expect(
      changeClientStatus({ clientId: 'c1', newStatus: 'active' }, makeCtx())
    ).resolves.toMatchObject({ success: true, newStatus: 'active' });
  });

  test('accepts newStatus="inactive"', async () => {
    mockTransaction.get.mockResolvedValue(makeClientDoc({ status: 'active' }));
    await expect(
      changeClientStatus({ clientId: 'c1', newStatus: 'inactive' }, makeCtx())
    ).resolves.toMatchObject({ success: true, newStatus: 'inactive' });
  });
});

// ═══════════════════════════════════════════════════════════════
// D. Rejection of derived-field inputs (PR-A.4 BREAKING CHANGE)
// ═══════════════════════════════════════════════════════════════

describe('D. Derived-field inputs rejected', () => {
  test('throws invalid-argument when caller sends isBlocked=true', async () => {
    await expect(
      changeClientStatus(
        { clientId: 'c1', newStatus: 'active', isBlocked: true },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('throws invalid-argument when caller sends isBlocked=false', async () => {
    await expect(
      changeClientStatus(
        { clientId: 'c1', newStatus: 'active', isBlocked: false },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('throws invalid-argument when caller sends isCritical=true', async () => {
    await expect(
      changeClientStatus(
        { clientId: 'c1', newStatus: 'active', isCritical: true },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('error message points caller at isOnHold for manual freeze', async () => {
    await expect(
      changeClientStatus(
        { clientId: 'c1', newStatus: 'active', isBlocked: true },
        makeCtx()
      )
    ).rejects.toThrow(/isOnHold/);
  });
});

// ═══════════════════════════════════════════════════════════════
// E. isOnHold acceptance + inactive constraint
// ═══════════════════════════════════════════════════════════════

describe('E. isOnHold acceptance', () => {
  test('throws invalid-argument: inactive + isOnHold=true', async () => {
    await expect(
      changeClientStatus(
        { clientId: 'c1', newStatus: 'inactive', isOnHold: true },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('accepts active + isOnHold=true', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({ status: 'active', isOnHold: false })
    );
    await expect(
      changeClientStatus(
        { clientId: 'c1', newStatus: 'active', isOnHold: true },
        makeCtx()
      )
    ).resolves.toMatchObject({ success: true, isOnHold: true });
  });

  test('accepts active + isOnHold omitted (defaults to false)', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({ status: 'inactive', isOnHold: false })
    );
    await expect(
      changeClientStatus(
        { clientId: 'c1', newStatus: 'active' },
        makeCtx()
      )
    ).resolves.toMatchObject({ success: true, isOnHold: false });
  });
});

// ═══════════════════════════════════════════════════════════════
// F. Client not-found
// ═══════════════════════════════════════════════════════════════

describe('F. Client not-found', () => {
  test('throws not-found when client document does not exist', async () => {
    mockTransaction.get.mockResolvedValue({ exists: false });
    await expect(
      changeClientStatus({ clientId: 'missing', newStatus: 'inactive' }, makeCtx())
    ).rejects.toMatchObject({ code: 'not-found' });
  });
});

// ═══════════════════════════════════════════════════════════════
// G. Same-state guard (status + isOnHold only)
// ═══════════════════════════════════════════════════════════════

describe('G. Same-state guard', () => {
  test('throws failed-precondition when status + isOnHold both unchanged', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({ status: 'active', isOnHold: false })
    );
    await expect(
      changeClientStatus(
        { clientId: 'c1', newStatus: 'active', isOnHold: false },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  test('allows transition when only isOnHold changes', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({ status: 'active', isOnHold: false })
    );
    await expect(
      changeClientStatus(
        { clientId: 'c1', newStatus: 'active', isOnHold: true },
        makeCtx()
      )
    ).resolves.toMatchObject({ success: true });
  });

  test('allows transition when only status changes', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({ status: 'active', isOnHold: false })
    );
    await expect(
      changeClientStatus(
        { clientId: 'c1', newStatus: 'inactive', isOnHold: false },
        makeCtx()
      )
    ).resolves.toMatchObject({ success: true });
  });
});

// ═══════════════════════════════════════════════════════════════
// H. Successful write through canonical helper
// ═══════════════════════════════════════════════════════════════

describe('H. Write through canonical helper', () => {
  test('writes status + isOnHold AND canonical derived aggregates', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({
        status: 'active',
        isOnHold: false,
        services: [makeHoursService('s1', { totalHours: 10, hoursUsed: 3 })],
        totalHours: 10
      })
    );
    await changeClientStatus(
      { clientId: 'c1', newStatus: 'active', isOnHold: true },
      makeCtx()
    );
    expect(mockTransaction.update).toHaveBeenCalledTimes(1);
    const [, payload] = mockTransaction.update.mock.calls[0];
    expect(payload).toMatchObject({
      status: 'active',
      isOnHold: true,
      isBlocked: false,        // derived — hours remaining
      isCritical: false,       // derived — > 5h remaining
      hoursUsed: 3,
      hoursRemaining: 7,
      totalHours: 10,
      lastModifiedBy: 'testuser'
    });
  });

  test('fixed-only client → isBlocked derived as false (I1)', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({
        status: 'active',
        isOnHold: false,
        services: [makeFixedService('s1')]
      })
    );
    await changeClientStatus(
      { clientId: 'c1', newStatus: 'active', isOnHold: true },
      makeCtx()
    );
    const [, payload] = mockTransaction.update.mock.calls[0];
    expect(payload.isBlocked).toBe(false);
    expect(payload.isOnHold).toBe(true);
  });

  test('depleted hours client → isBlocked derived as true', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({
        status: 'active',
        isOnHold: false,
        services: [makeHoursService('s1', { totalHours: 10, hoursUsed: 10 })],
        totalHours: 10
      })
    );
    await changeClientStatus(
      { clientId: 'c1', newStatus: 'inactive' },
      makeCtx()
    );
    const [, payload] = mockTransaction.update.mock.calls[0];
    expect(payload.isBlocked).toBe(true);
    expect(payload.hoursRemaining).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// I. Audit log emission
// ═══════════════════════════════════════════════════════════════

describe('I. Audit log emission', () => {
  test('logAction called with new payload shape (includes isOnHold + derived)', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({
        fullName: 'שלומי לחיאני',
        status: 'active',
        isOnHold: false,
        isBlocked: false,
        isCritical: false,
        services: [makeHoursService('s1', { totalHours: 10, hoursUsed: 7 })],
        totalHours: 10
      })
    );
    await changeClientStatus(
      { clientId: 'c1', newStatus: 'active', isOnHold: true, note: 'unpaid invoice' },
      makeCtx()
    );
    expect(mockLogAction).toHaveBeenCalledTimes(1);
    expect(mockLogAction).toHaveBeenCalledWith(
      'CHANGE_CLIENT_STATUS',
      'user1',
      'testuser',
      expect.objectContaining({
        clientId: 'c1',
        clientName: 'שלומי לחיאני',
        previousStatus: 'active',
        newStatus: 'active',
        previousIsOnHold: false,
        newIsOnHold: true,
        previousIsBlocked: false,
        previousIsCritical: false,
        derivedIsBlocked: false,
        derivedIsCritical: true,  // hoursRemaining=3 <= 5
        note: 'unpaid invoice'
      })
    );
  });

  test('note is trimmed to 500 chars', async () => {
    mockTransaction.get.mockResolvedValue(makeClientDoc({ isOnHold: false }));
    const longNote = 'x'.repeat(600);
    await changeClientStatus(
      { clientId: 'c1', newStatus: 'active', isOnHold: true, note: longNote },
      makeCtx()
    );
    const noteArg = mockLogAction.mock.calls[0][3].note;
    expect(noteArg.length).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// J. Return value structure
// ═══════════════════════════════════════════════════════════════

describe('J. Return value structure', () => {
  test('returns status object with isOnHold + derived isBlocked/isCritical', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({
        fullName: 'שלומי לחיאני',
        status: 'active',
        isOnHold: false,
        isBlocked: false,
        isCritical: false,
        services: [makeHoursService('s1', { totalHours: 10, hoursUsed: 4 })],
        totalHours: 10
      })
    );
    const result = await changeClientStatus(
      { clientId: 'c1', newStatus: 'active', isOnHold: true },
      makeCtx()
    );
    expect(result).toMatchObject({
      success: true,
      previousStatus: 'active',
      newStatus: 'active',
      previousIsOnHold: false,
      isOnHold: true,
      previousIsBlocked: false,
      previousIsCritical: false,
      isBlocked: false,    // derived
      isCritical: false    // derived (hoursRemaining=6 > 5)
    });
    expect(result.statusChangedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.message).toContain('שלומי לחיאני');
    expect(result.message).toContain('מוקפא');
  });
});

// ═══════════════════════════════════════════════════════════════
// K. Invariant bypass defense (PR-A.4 M8)
// ═══════════════════════════════════════════════════════════════

describe('K. Bypass attempts blocked', () => {
  test('caller attempt to send both isOnHold AND isBlocked → rejected before any write', async () => {
    await expect(
      changeClientStatus(
        {
          clientId: 'c1',
          newStatus: 'active',
          isOnHold: true,
          isBlocked: true  // attempt bypass
        },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(mockTransaction.update).not.toHaveBeenCalled();
    expect(mockLogAction).not.toHaveBeenCalled();
  });

  test('caller attempt to send isCritical=true on healthy client → rejected', async () => {
    // Even though "critical" might seem like a legitimate manual flag,
    // it's now derived. Reject the input to prevent drift.
    await expect(
      changeClientStatus(
        { clientId: 'c1', newStatus: 'active', isCritical: true },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(mockTransaction.update).not.toHaveBeenCalled();
  });

  test('helper recomputes aggregates even if caller did not request status change', async () => {
    // The helper is the SoT. Any successful call recomputes from services
    // regardless of what the caller asked. This is what stops drift.
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({
        status: 'active',
        isOnHold: false,
        // DB has stale isBlocked=true on a fixed-only client (the 23-victim scenario)
        isBlocked: true,
        services: [makeFixedService('s1')]
      })
    );
    await changeClientStatus(
      { clientId: 'c1', newStatus: 'active', isOnHold: true },
      makeCtx()
    );
    const [, payload] = mockTransaction.update.mock.calls[0];
    // Helper corrected stale value: fixed-only ⇒ isBlocked=false (I1).
    expect(payload.isBlocked).toBe(false);
    expect(payload.isOnHold).toBe(true);
  });
});
