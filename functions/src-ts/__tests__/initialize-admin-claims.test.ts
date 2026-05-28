/**
 * initializeAdminClaims — runtime + static guards (Pre-H.0.0.B)
 * ─────────────────────────────────────────────────────────────────────────────
 * Same dual-layer pattern as set-admin-claims.test.ts. The function is more
 * complex because it iterates the `employees` collection and locks; tests
 * cover: auth gate, lock contention, idempotency (skip already-granted),
 * email-fallback warning, audit-FIRST per employee, parallel-call lock.
 */
import * as fs from 'fs';
import * as path from 'path';

// ─── Mock state ─────────────────────────────────────────────────────────────
const mockSetCustomUserClaims = jest.fn();
const mockGetUser = jest.fn();
const mockGetUserByEmail = jest.fn();
const mockAuditAdd = jest.fn();
const mockEmployeesGet = jest.fn();
const mockLockGet = jest.fn();
const mockLockSet = jest.fn();
const mockLockDelete = jest.fn();

jest.mock('firebase-admin', () => {
  // Make `db.collection('employees').where('isAdmin','==',true).get()` route
  // to mockEmployeesGet, while `db.collection('audit_log').add(...)` routes
  // to mockAuditAdd.
  function collection(name: string): unknown {
    if (name === 'audit_log') {
      return { add: mockAuditAdd };
    }
    if (name === 'employees') {
      return { where: jest.fn(() => ({ get: mockEmployeesGet })) };
    }
    return { add: jest.fn(), where: jest.fn() };
  }
  // `db.doc('system/admin_claims_init_lock')` returns a ref with get/set/delete.
  function doc(_path: string): unknown {
    return {
      get: mockLockGet,
      set: mockLockSet,
      delete: mockLockDelete
    };
  }
  const firestoreFn: jest.Mock & { FieldValue?: unknown } = jest.fn(() => ({
    collection,
    doc
  }));
  firestoreFn.FieldValue = {
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP_SENTINEL')
  };
  return {
    auth: jest.fn(() => ({
      getUser: mockGetUser,
      getUserByEmail: mockGetUserByEmail,
      setCustomUserClaims: mockSetCustomUserClaims
    })),
    firestore: firestoreFn
  };
});

import { initializeAdminClaimsHandler } from '../initialize-admin-claims';

// ─── Fixtures ───────────────────────────────────────────────────────────────
const ADMIN_UID = 'admin-caller-uid-test-fixture-x';

function makeRequest(overrides: Record<string, unknown> = {}): Parameters<typeof initializeAdminClaimsHandler>[0] {
  const baseAuth = overrides.auth === null
    ? null
    : { uid: ADMIN_UID, token: { role: 'admin' } };
  return {
    auth: baseAuth,
    data: {},
    ...overrides
  } as unknown as Parameters<typeof initializeAdminClaimsHandler>[0];
}

function makeEmployeeSnapshot(docs: Array<{ id: string; data: Record<string, unknown> }>): unknown {
  return {
    docs: docs.map((d) => ({
      id: d.id,
      data: () => d.data
    }))
  };
}

beforeEach(() => {
  mockSetCustomUserClaims.mockReset().mockResolvedValue(undefined);
  mockGetUser.mockReset();
  mockGetUserByEmail.mockReset();
  mockAuditAdd.mockReset().mockResolvedValue({ id: 'audit-fixture' });
  mockEmployeesGet.mockReset().mockResolvedValue(makeEmployeeSnapshot([]));
  mockLockGet.mockReset().mockResolvedValue({ exists: false, data: () => null });
  mockLockSet.mockReset().mockResolvedValue(undefined);
  mockLockDelete.mockReset().mockResolvedValue(undefined);
});

// ════════════════════════════════════════════════════════════════════════════
// Static AST invariants
// ════════════════════════════════════════════════════════════════════════════
describe('initializeAdminClaims — static AST invariants', () => {
  let source: string;

  beforeAll(() => {
    const sourcePath = path.resolve(__dirname, '../initialize-admin-claims.ts');
    source = fs.readFileSync(sourcePath, 'utf8');
  });

  it('contains dual-shape claim literal', () => {
    expect(source).toMatch(/\{\s*admin:\s*true,\s*role:\s*'admin'\s*\}/);
  });

  it('uses lock document at system/admin_claims_init_lock', () => {
    expect(source).toContain("'system/admin_claims_init_lock'");
  });

  it('idempotency: checks alreadyGranted before writing', () => {
    expect(source).toContain('alreadyGranted');
    expect(source).toContain('existingClaims.admin === true');
    expect(source).toContain("existingClaims.role === 'admin'");
  });

  it('email-fallback path emits warning log', () => {
    expect(source).toContain('admin_claims.initialize.email_fallback');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Auth gate
// ════════════════════════════════════════════════════════════════════════════
describe('initializeAdminClaimsHandler — auth gate', () => {
  it('rejects unauthenticated (no auth object)', async () => {
    const req = makeRequest({ auth: null });
    await expect(initializeAdminClaimsHandler(req)).rejects.toMatchObject({
      code: 'unauthenticated'
    });
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
    expect(mockLockSet).not.toHaveBeenCalled();
  });

  it('rejects non-admin (CRITICAL — legacy version skipped this check)', async () => {
    const req = makeRequest({
      auth: { uid: 'employee-uid', token: { role: 'employee' } }
    });
    await expect(initializeAdminClaimsHandler(req)).rejects.toMatchObject({
      code: 'permission-denied'
    });
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
  });

  it('accepts admin via canonical {role:\'admin\'}', async () => {
    const req = makeRequest({ auth: { uid: ADMIN_UID, token: { role: 'admin' } } });
    const result = await initializeAdminClaimsHandler(req);
    expect(result.success).toBe(true);
  });

  it('accepts admin via legacy {admin:true}', async () => {
    const req = makeRequest({ auth: { uid: ADMIN_UID, token: { admin: true } } });
    const result = await initializeAdminClaimsHandler(req);
    expect(result.success).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Lock semantics
// ════════════════════════════════════════════════════════════════════════════
describe('initializeAdminClaimsHandler — lock contention', () => {
  it('rejects when another caller holds a fresh lock', async () => {
    mockLockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        lockedAt: { toMillis: () => Date.now() - 1000 }, // 1s old, fresh
        lockedBy: 'other-admin-uid'
      })
    });
    const req = makeRequest();
    await expect(initializeAdminClaimsHandler(req)).rejects.toMatchObject({
      code: 'failed-precondition'
    });
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
  });

  it('proceeds when existing lock is older than TTL (5min)', async () => {
    const SIX_MIN_AGO_MS = Date.now() - 6 * 60 * 1000;
    mockLockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        lockedAt: { toMillis: () => SIX_MIN_AGO_MS },
        lockedBy: 'crashed-previous-run'
      })
    });
    const req = makeRequest();
    const result = await initializeAdminClaimsHandler(req);
    expect(result.success).toBe(true);
    expect(mockLockSet).toHaveBeenCalled();
  });

  it('releases lock on success', async () => {
    const req = makeRequest();
    await initializeAdminClaimsHandler(req);
    expect(mockLockDelete).toHaveBeenCalledTimes(1);
  });

  it('releases lock even when an employee processing throws', async () => {
    mockEmployeesGet.mockRejectedValueOnce(new Error('Firestore down'));
    const req = makeRequest();
    await expect(initializeAdminClaimsHandler(req)).rejects.toBeDefined();
    expect(mockLockDelete).toHaveBeenCalledTimes(1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Idempotency
// ════════════════════════════════════════════════════════════════════════════
describe('initializeAdminClaimsHandler — idempotency', () => {
  it('skips employees whose claim ALREADY matches dual-shape', async () => {
    mockEmployeesGet.mockResolvedValueOnce(makeEmployeeSnapshot([
      { id: 'already@example.com', data: { email: 'already@example.com', authUID: 'uid-1', isAdmin: true } }
    ]));
    mockGetUser.mockResolvedValueOnce({
      uid: 'uid-1',
      customClaims: { admin: true, role: 'admin' }
    });

    const req = makeRequest();
    const result = await initializeAdminClaimsHandler(req);

    expect(result.granted).toBe(0);
    expect(result.skippedAlreadyGranted).toBe(1);
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
    expect(mockAuditAdd).not.toHaveBeenCalled();
  });

  it('grants to employee with only legacy {admin:true} (claim needs the new shape too)', async () => {
    mockEmployeesGet.mockResolvedValueOnce(makeEmployeeSnapshot([
      { id: 'legacy@example.com', data: { email: 'legacy@example.com', authUID: 'uid-2', isAdmin: true } }
    ]));
    mockGetUser.mockResolvedValueOnce({
      uid: 'uid-2',
      customClaims: { admin: true } // missing role
    });

    const req = makeRequest();
    const result = await initializeAdminClaimsHandler(req);

    expect(result.granted).toBe(1);
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('uid-2', {
      admin: true,
      role: 'admin'
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Email-fallback (devils-advocate concern: email drift)
// ════════════════════════════════════════════════════════════════════════════
describe('initializeAdminClaimsHandler — auth UID resolution', () => {
  it('prefers employees.authUID over email', async () => {
    mockEmployeesGet.mockResolvedValueOnce(makeEmployeeSnapshot([
      { id: 'good@example.com', data: { email: 'good@example.com', authUID: 'preferred-uid', isAdmin: true } }
    ]));
    mockGetUser.mockResolvedValueOnce({ uid: 'preferred-uid', customClaims: {} });

    await initializeAdminClaimsHandler(makeRequest());

    expect(mockGetUser).toHaveBeenCalledWith('preferred-uid');
    expect(mockGetUserByEmail).not.toHaveBeenCalled();
  });

  it('falls back to email lookup when authUID missing', async () => {
    mockEmployeesGet.mockResolvedValueOnce(makeEmployeeSnapshot([
      { id: 'fallback@example.com', data: { email: 'fallback@example.com', isAdmin: true } } // no authUID
    ]));
    mockGetUserByEmail.mockResolvedValueOnce({ uid: 'fallback-uid', customClaims: {} });

    const result = await initializeAdminClaimsHandler(makeRequest());

    expect(mockGetUserByEmail).toHaveBeenCalledWith('fallback@example.com');
    expect(result.granted).toBe(1);
  });

  it('records skipped_no_email when employee doc has no email field', async () => {
    mockEmployeesGet.mockResolvedValueOnce(makeEmployeeSnapshot([
      { id: 'malformed-doc-id', data: { isAdmin: true } } // no email
    ]));

    const result = await initializeAdminClaimsHandler(makeRequest());

    expect(result.granted).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.results[0].outcome).toBe('skipped_no_email');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Fail-secure ordering per employee
// ════════════════════════════════════════════════════════════════════════════
describe('initializeAdminClaimsHandler — audit-FIRST per employee', () => {
  it('does NOT write claim if audit write fails for that employee', async () => {
    mockEmployeesGet.mockResolvedValueOnce(makeEmployeeSnapshot([
      { id: 'e@example.com', data: { email: 'e@example.com', authUID: 'uid-x', isAdmin: true } }
    ]));
    mockGetUser.mockResolvedValueOnce({ uid: 'uid-x', customClaims: {} });
    mockAuditAdd.mockRejectedValueOnce(new Error('Firestore unavailable'));

    const result = await initializeAdminClaimsHandler(makeRequest());

    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
    expect(result.results[0].outcome).toBe('skipped_audit_failed');
    expect(result.failed).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Happy path with multiple employees
// ════════════════════════════════════════════════════════════════════════════
describe('initializeAdminClaimsHandler — happy path', () => {
  it('processes a mix: granted + skipped + failed in one call', async () => {
    mockEmployeesGet.mockResolvedValueOnce(makeEmployeeSnapshot([
      { id: 'new@example.com', data: { email: 'new@example.com', authUID: 'uid-new', isAdmin: true } },
      { id: 'exists@example.com', data: { email: 'exists@example.com', authUID: 'uid-exists', isAdmin: true } },
      { id: 'missing@example.com', data: { email: 'missing@example.com', authUID: 'uid-missing', isAdmin: true } }
    ]));

    mockGetUser
      .mockResolvedValueOnce({ uid: 'uid-new', customClaims: {} })
      .mockResolvedValueOnce({ uid: 'uid-exists', customClaims: { admin: true, role: 'admin' } })
      .mockRejectedValueOnce({ code: 'auth/user-not-found' });

    const result = await initializeAdminClaimsHandler(makeRequest());

    expect(result.scanned).toBe(3);
    expect(result.granted).toBe(1);
    expect(result.skippedAlreadyGranted).toBe(1);
    expect(result.failed).toBe(1);

    // Only the new one received the claim write
    expect(mockSetCustomUserClaims).toHaveBeenCalledTimes(1);
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('uid-new', {
      admin: true,
      role: 'admin'
    });
  });
});
