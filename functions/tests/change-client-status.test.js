/**
 * Regression baseline for `changeClientStatus` CF (functions/clients/index.js).
 *
 * Purpose: lock current behavior BEFORE the PR-A refactor that introduces
 * `writeClientWithCanonicalAggregates` and deprecates caller-supplied
 * `isBlocked` in favor of a derived value + a separate `isOnHold` manual flag.
 *
 * Coverage (current implementation, no behavioral changes):
 *  A. Authentication — propagates errors from checkUserPermissions
 *  B. clientId validation — required + string
 *  C. newStatus validation — required + must be 'active' or 'inactive'
 *  D. isBlocked / isCritical mutual exclusion
 *  E. Inactive status disallows isBlocked/isCritical
 *  F. Client not-found
 *  G. Same-state guard (status + flags identical)
 *  H. Successful write transitions (active → blocked, blocked → active, etc.)
 *  I. Audit log emission shape
 *  J. Return value structure
 *
 * After PR-A merges, some of these will need to change. Each obsolete test
 * must be retained-but-skipped with a `// CONTRACT-CHANGED-IN-PR-A` comment
 * pointing at the new test that replaces it, so the regression history is
 * preserved.
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

// ═══════════════════════════════════════════════════════════════
// Test helpers
// ═══════════════════════════════════════════════════════════════

function makeClientDoc(overrides = {}) {
  return {
    exists: true,
    data: () => ({
      fullName: 'לקוח טסט',
      status: 'active',
      isBlocked: false,
      isCritical: false,
      services: [],
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
// D. isBlocked / isCritical mutual exclusion
// CONTRACT-CHANGED-IN-PR-A: isBlocked will become derived, not caller input.
// ═══════════════════════════════════════════════════════════════

describe('D. isBlocked / isCritical mutual exclusion (current behavior)', () => {
  test('throws invalid-argument when both isBlocked and isCritical are true', async () => {
    await expect(
      changeClientStatus(
        { clientId: 'c1', newStatus: 'active', isBlocked: true, isCritical: true },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('allows isBlocked=true alone', async () => {
    mockTransaction.get.mockResolvedValue(makeClientDoc());
    await expect(
      changeClientStatus(
        { clientId: 'c1', newStatus: 'active', isBlocked: true },
        makeCtx()
      )
    ).resolves.toMatchObject({ success: true, isBlocked: true, isCritical: false });
  });

  test('allows isCritical=true alone', async () => {
    mockTransaction.get.mockResolvedValue(makeClientDoc());
    await expect(
      changeClientStatus(
        { clientId: 'c1', newStatus: 'active', isCritical: true },
        makeCtx()
      )
    ).resolves.toMatchObject({ success: true, isBlocked: false, isCritical: true });
  });
});

// ═══════════════════════════════════════════════════════════════
// E. Inactive constraints
// ═══════════════════════════════════════════════════════════════

describe('E. Inactive constraints', () => {
  test('throws invalid-argument: inactive + isBlocked=true', async () => {
    await expect(
      changeClientStatus(
        { clientId: 'c1', newStatus: 'inactive', isBlocked: true },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('throws invalid-argument: inactive + isCritical=true', async () => {
    await expect(
      changeClientStatus(
        { clientId: 'c1', newStatus: 'inactive', isCritical: true },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });
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
// G. Same-state guard
// ═══════════════════════════════════════════════════════════════

describe('G. Same-state guard', () => {
  test('throws failed-precondition when status + flags all match current', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({ status: 'active', isBlocked: false, isCritical: false })
    );
    await expect(
      changeClientStatus(
        { clientId: 'c1', newStatus: 'active', isBlocked: false, isCritical: false },
        makeCtx()
      )
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  test('allows transition when only isCritical changes', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({ status: 'active', isBlocked: false, isCritical: false })
    );
    await expect(
      changeClientStatus(
        { clientId: 'c1', newStatus: 'active', isCritical: true },
        makeCtx()
      )
    ).resolves.toMatchObject({ success: true });
  });
});

// ═══════════════════════════════════════════════════════════════
// H. Successful write transitions
// CONTRACT-CHANGED-IN-PR-A: writes will go through writeClientWithCanonicalAggregates
// ═══════════════════════════════════════════════════════════════

describe('H. Successful write transitions (current behavior)', () => {
  test('active → inactive: writes status only, flags cleared', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({ status: 'active', isBlocked: false, isCritical: false })
    );
    await changeClientStatus(
      { clientId: 'c1', newStatus: 'inactive' },
      makeCtx()
    );
    expect(mockTransaction.update).toHaveBeenCalledTimes(1);
    const [, payload] = mockTransaction.update.mock.calls[0];
    expect(payload).toMatchObject({
      status: 'inactive',
      isBlocked: false,
      isCritical: false,
      lastModifiedBy: 'testuser'
    });
  });

  test('active → blocked: writes isBlocked=true', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({ status: 'active', isBlocked: false, isCritical: false })
    );
    await changeClientStatus(
      { clientId: 'c1', newStatus: 'active', isBlocked: true },
      makeCtx()
    );
    const [, payload] = mockTransaction.update.mock.calls[0];
    expect(payload).toMatchObject({
      status: 'active',
      isBlocked: true,
      isCritical: false
    });
  });

  test('blocked → active: writes isBlocked=false (manual unblock works today)', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({ status: 'active', isBlocked: true, isCritical: false })
    );
    await changeClientStatus(
      { clientId: 'c1', newStatus: 'active', isBlocked: false },
      makeCtx()
    );
    const [, payload] = mockTransaction.update.mock.calls[0];
    expect(payload).toMatchObject({
      status: 'active',
      isBlocked: false,
      isCritical: false
    });
  });

  test('active → critical: writes isCritical=true', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({ status: 'active', isBlocked: false, isCritical: false })
    );
    await changeClientStatus(
      { clientId: 'c1', newStatus: 'active', isCritical: true },
      makeCtx()
    );
    const [, payload] = mockTransaction.update.mock.calls[0];
    expect(payload).toMatchObject({
      status: 'active',
      isBlocked: false,
      isCritical: true
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// I. Audit log emission shape
// ═══════════════════════════════════════════════════════════════

describe('I. Audit log emission', () => {
  test('logAction called with CHANGE_CLIENT_STATUS action + full payload', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({
        fullName: 'שלומי לחיאני',
        status: 'active',
        isBlocked: false,
        isCritical: false
      })
    );
    await changeClientStatus(
      { clientId: 'c1', newStatus: 'active', isBlocked: true, note: 'no payment' },
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
        previousIsBlocked: false,
        previousIsCritical: false,
        newIsBlocked: true,
        newIsCritical: false,
        note: 'no payment'
      })
    );
  });

  test('note is trimmed to 500 chars', async () => {
    mockTransaction.get.mockResolvedValue(makeClientDoc());
    const longNote = 'x'.repeat(600);
    await changeClientStatus(
      { clientId: 'c1', newStatus: 'active', isBlocked: true, note: longNote },
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
  test('returns full status object with previous + new values', async () => {
    mockTransaction.get.mockResolvedValue(
      makeClientDoc({
        fullName: 'שלומי לחיאני',
        status: 'active',
        isBlocked: false,
        isCritical: false
      })
    );
    const result = await changeClientStatus(
      { clientId: 'c1', newStatus: 'active', isBlocked: true },
      makeCtx()
    );
    expect(result).toMatchObject({
      success: true,
      previousStatus: 'active',
      newStatus: 'active',
      previousIsBlocked: false,
      previousIsCritical: false,
      isBlocked: true,
      isCritical: false
    });
    expect(result.statusChangedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.message).toContain('שלומי לחיאני');
  });
});
