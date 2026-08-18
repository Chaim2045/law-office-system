/**
 * syncRoleClaims — runtime + static guards (Pre-H.0.0.F)
 * ─────────────────────────────────────────────────────────────────────────────
 * Mirrors initialize-admin-claims.test.ts (iterate employees + lock + audit-FIRST)
 * and adds F-specific coverage: dry-run/apply gate integrity, role transitions
 * (partner grant / lawyer removal / drift correction), read-merge-write no-clobber,
 * idempotency, and the messages.toRoles partner-grant gate.
 *
 * Public-repo safety: synthetic fixtures only; no real emails/UIDs.
 */
import * as fs from 'fs';
import * as path from 'path';

// ─── Mock state ─────────────────────────────────────────────────────────────
const mockSetCustomUserClaims = jest.fn();
const mockGetUser = jest.fn();
const mockGetUserByEmail = jest.fn();
const mockEmployeesGet = jest.fn();
const mockMessagesGet = jest.fn();
const mockLockGet = jest.fn();
const mockLockSet = jest.fn();
const mockLockDelete = jest.fn();
const mockLogCriticalAction = jest.fn();

jest.mock('../audit-critical', () => ({
  logCriticalAction: (...args: unknown[]) => mockLogCriticalAction(...args)
}));

jest.mock('firebase-admin', () => {
  function collection(name: string): unknown {
    if (name === 'employees') {
      return { get: mockEmployeesGet };
    }
    if (name === 'messages') {
      // .where('toRoles','array-contains', role).limit(n).get() — route by role.
      return {
        where: (_f: string, _op: string, val: string) => ({
          limit: () => ({ get: () => mockMessagesGet(val) })
        })
      };
    }
    return { get: jest.fn(), where: jest.fn() };
  }
  function doc(_path: string): unknown {
    return { get: mockLockGet, set: mockLockSet, delete: mockLockDelete };
  }
  const firestoreFn: jest.Mock & { FieldValue?: unknown } = jest.fn(() => ({ collection, doc }));
  firestoreFn.FieldValue = { serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP_SENTINEL') };
  return {
    auth: jest.fn(() => ({
      getUser: mockGetUser,
      getUserByEmail: mockGetUserByEmail,
      setCustomUserClaims: mockSetCustomUserClaims
    })),
    firestore: firestoreFn
  };
});

import { syncRoleClaimsHandler } from '../sync-role-claims';

const ADMIN_UID = 'admin-caller-uid-test-fixture-x';

function makeRequest(overrides: Record<string, unknown> = {}): Parameters<typeof syncRoleClaimsHandler>[0] {
  const baseAuth = overrides.auth === null ? null : { uid: ADMIN_UID, token: { role: 'admin' } };
  return { auth: baseAuth, data: {}, ...overrides } as unknown as Parameters<typeof syncRoleClaimsHandler>[0];
}

function makeEmployeeSnapshot(docs: Array<{ id: string; data: Record<string, unknown> }>): unknown {
  return { docs: docs.map((d) => ({ id: d.id, data: () => d.data })) };
}

function messagesSnap(size: number): unknown {
  return { size, docs: Array.from({ length: size }, (_v, i) => ({ id: `m${i}`, data: () => ({ toRoles: ['partner'] }) })) };
}

beforeEach(() => {
  mockSetCustomUserClaims.mockReset().mockResolvedValue(undefined);
  mockGetUser.mockReset();
  mockGetUserByEmail.mockReset();
  mockEmployeesGet.mockReset().mockResolvedValue(makeEmployeeSnapshot([]));
  mockMessagesGet.mockReset().mockResolvedValue(messagesSnap(0));
  mockLockGet.mockReset().mockResolvedValue({ exists: false, data: () => null });
  mockLockSet.mockReset().mockResolvedValue(undefined);
  mockLockDelete.mockReset().mockResolvedValue(undefined);
  mockLogCriticalAction.mockReset().mockResolvedValue('audit-fixture');
});

// ════════════════════════════════════════════════════════════════════════════
// Static AST invariants
// ════════════════════════════════════════════════════════════════════════════
describe('syncRoleClaims — static AST invariants', () => {
  let source: string;
  beforeAll(() => { source = fs.readFileSync(path.resolve(__dirname, '../sync-role-claims.ts'), 'utf8'); });

  it('uses the shared read-merge-write primitives (no inline full-replace)', () => {
    expect(source).toMatch(/from\s+['"]\.\.\/shared\/claim-writer['"]/);
    expect(source).toContain('mergeRoleClaim');
    expect(source).toContain('removeRoleClaim');
  });

  it('apply gate is a strict === true comparison (never !== false)', () => {
    expect(source).toMatch(/\.apply === true/);
    expect(source).not.toMatch(/apply\s*!==\s*false/);
  });

  it('uses a lock document', () => {
    expect(source).toContain("'system/role_claims_sync_lock'");
  });

  it('uses canonical logCriticalAction (no local clone)', () => {
    expect(source).toContain('logCriticalAction');
    expect(source).toMatch(/from\s+['"]\.\/audit-critical['"]/);
    expect(source).not.toContain('function writeAuditOrThrow');
  });

  it('never writes admin:true (role-only writer)', () => {
    expect(source).not.toMatch(/setCustomUserClaims\([^)]*admin:\s*true/);
  });

  it('no PII (email / claim objects) reaches logger.*', () => {
    const FORBIDDEN = [
      /logger\.\w+\([^)]*empDoc\.id/,
      /logger\.\w+\([^)]*:\s*email\b/,
      /logger\.\w+\([^)]*targetEmail/,
      /logger\.\w+\([^)]*userRecord\.email/,
      /logger\.\w+\([^)]*\bpreviousClaims\b/,
      /logger\.\w+\([^)]*\bnewClaims\b/,
      /logger\.\w+\([^)]*customClaims/
    ];
    for (const p of FORBIDDEN) { expect(source).not.toMatch(p); }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Auth gate
// ════════════════════════════════════════════════════════════════════════════
describe('syncRoleClaimsHandler — auth gate', () => {
  it('rejects unauthenticated', async () => {
    await expect(syncRoleClaimsHandler(makeRequest({ auth: null }))).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(mockLockSet).not.toHaveBeenCalled();
  });

  it('rejects non-admin', async () => {
    await expect(syncRoleClaimsHandler(makeRequest({ auth: { uid: 'e', token: { role: 'employee' } } })))
      .rejects.toMatchObject({ code: 'permission-denied' });
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
  });

  it('REJECTS a legacy {admin:true}-only token (role-only gate, post-E follow-up)', async () => {
    await expect(syncRoleClaimsHandler(makeRequest({ auth: { uid: ADMIN_UID, token: { admin: true } } })))
      .rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('accepts admin via {role:\'admin\'}', async () => {
    const r = await syncRoleClaimsHandler(makeRequest());
    expect(r.success).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Dry-run / apply gate integrity
// ════════════════════════════════════════════════════════════════════════════
describe('syncRoleClaimsHandler — dry-run/apply gate', () => {
  const driftRow = [{ id: 'p@example.com', data: { email: 'p@example.com', authUID: 'uid-p', role: 'partner' } }];

  it('defaults to dry-run — computes plan, writes NOTHING, audits NOTHING', async () => {
    mockEmployeesGet.mockResolvedValueOnce(makeEmployeeSnapshot(driftRow));
    mockGetUser.mockResolvedValueOnce({ uid: 'uid-p', customClaims: {} });
    const r = await syncRoleClaimsHandler(makeRequest());
    expect(r.mode).toBe('dry-run');
    expect(r.granted).toBe(1); // planned
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
    expect(mockLogCriticalAction).not.toHaveBeenCalled();
  });

  it('apply:false stays dry-run', async () => {
    mockEmployeesGet.mockResolvedValueOnce(makeEmployeeSnapshot(driftRow));
    mockGetUser.mockResolvedValueOnce({ uid: 'uid-p', customClaims: {} });
    await syncRoleClaimsHandler(makeRequest({ data: { apply: false } }));
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
  });

  it('rejects non-boolean apply (Zod strict — no truthiness coercion)', async () => {
    await expect(syncRoleClaimsHandler(makeRequest({ data: { apply: 'true' } })))
      .rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(syncRoleClaimsHandler(makeRequest({ data: { apply: 1 } })))
      .rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects unknown extra fields (.strict())', async () => {
    await expect(syncRoleClaimsHandler(makeRequest({ data: { apply: true, malicious: 'x' } })))
      .rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('apply:true writes only on drift', async () => {
    mockEmployeesGet.mockResolvedValueOnce(makeEmployeeSnapshot(driftRow));
    mockGetUser.mockResolvedValueOnce({ uid: 'uid-p', customClaims: {} });
    const r = await syncRoleClaimsHandler(makeRequest({ data: { apply: true } }));
    expect(r.mode).toBe('apply');
    expect(mockSetCustomUserClaims).toHaveBeenCalledTimes(1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Lock semantics
// ════════════════════════════════════════════════════════════════════════════
describe('syncRoleClaimsHandler — lock', () => {
  it('rejects when a fresh lock is held', async () => {
    mockLockGet.mockResolvedValueOnce({ exists: true, data: () => ({ lockedAt: { toMillis: () => Date.now() - 1000 } }) });
    await expect(syncRoleClaimsHandler(makeRequest())).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('proceeds when the lock is older than TTL', async () => {
    mockLockGet.mockResolvedValueOnce({ exists: true, data: () => ({ lockedAt: { toMillis: () => Date.now() - 6 * 60 * 1000 } }) });
    const r = await syncRoleClaimsHandler(makeRequest());
    expect(r.success).toBe(true);
    expect(mockLockSet).toHaveBeenCalled();
  });

  it('releases the lock on success', async () => {
    await syncRoleClaimsHandler(makeRequest());
    expect(mockLockDelete).toHaveBeenCalledTimes(1);
  });

  it('releases the lock even when scanning throws', async () => {
    mockEmployeesGet.mockRejectedValueOnce(new Error('Firestore down'));
    await expect(syncRoleClaimsHandler(makeRequest())).rejects.toBeDefined();
    expect(mockLockDelete).toHaveBeenCalledTimes(1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Role transitions (apply)
// ════════════════════════════════════════════════════════════════════════════
describe('syncRoleClaimsHandler — role transitions', () => {
  function oneEmp(role: string, claims: Record<string, unknown>): void {
    mockEmployeesGet.mockResolvedValueOnce(makeEmployeeSnapshot([
      { id: 'x@example.com', data: { email: 'x@example.com', authUID: 'uid-x', role } }
    ]));
    mockGetUser.mockResolvedValueOnce({ uid: 'uid-x', customClaims: claims });
  }

  it('employee→partner GRANT writes {role:\'partner\'}', async () => {
    oneEmp('partner', {});
    const r = await syncRoleClaimsHandler(makeRequest({ data: { apply: true } }));
    expect(r.granted).toBe(1);
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('uid-x', { role: 'partner' });
  });

  it('admin already admin → no_change, no write', async () => {
    oneEmp('admin', { role: 'admin' });
    const r = await syncRoleClaimsHandler(makeRequest({ data: { apply: true } }));
    expect(r.noChange).toBe(1);
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
  });

  it('lawyer residue → removed (role claim cleared)', async () => {
    oneEmp('employee', { role: 'lawyer' });
    const r = await syncRoleClaimsHandler(makeRequest({ data: { apply: true } }));
    expect(r.removed).toBe(1);
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('uid-x', {});
  });

  it('drift correction (admin claim but Firestore says partner)', async () => {
    oneEmp('partner', { role: 'admin' });
    await syncRoleClaimsHandler(makeRequest({ data: { apply: true } }));
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('uid-x', { role: 'partner' });
  });

  it('missing Firestore role → skipped_no_role, never blind-clears', async () => {
    mockEmployeesGet.mockResolvedValueOnce(makeEmployeeSnapshot([
      { id: 'norole@example.com', data: { email: 'norole@example.com', authUID: 'uid-n' } }
    ]));
    const r = await syncRoleClaimsHandler(makeRequest({ data: { apply: true } }));
    expect(r.results[0].outcome).toBe('skipped_no_role');
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// No-clobber (the §7.5 prerequisite carried from E)
// ════════════════════════════════════════════════════════════════════════════
describe('syncRoleClaimsHandler — read-merge-write no-clobber', () => {
  it('GRANT preserves other claim fields (oldUsername survives)', async () => {
    mockEmployeesGet.mockResolvedValueOnce(makeEmployeeSnapshot([
      { id: 'g@example.com', data: { email: 'g@example.com', authUID: 'uid-g', role: 'partner' } }
    ]));
    mockGetUser.mockResolvedValueOnce({ uid: 'uid-g', customClaims: { role: 'admin', oldUsername: 'legacy' } });
    await syncRoleClaimsHandler(makeRequest({ data: { apply: true } }));
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('uid-g', { role: 'partner', oldUsername: 'legacy' });
  });

  it('REMOVE drops only role, preserving other fields', async () => {
    mockEmployeesGet.mockResolvedValueOnce(makeEmployeeSnapshot([
      { id: 'r@example.com', data: { email: 'r@example.com', authUID: 'uid-r', role: 'employee' } }
    ]));
    mockGetUser.mockResolvedValueOnce({ uid: 'uid-r', customClaims: { role: 'lawyer', oldUsername: 'keep' } });
    await syncRoleClaimsHandler(makeRequest({ data: { apply: true } }));
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('uid-r', { oldUsername: 'keep' });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Idempotency
// ════════════════════════════════════════════════════════════════════════════
describe('syncRoleClaimsHandler — idempotency', () => {
  it('no-drift apply writes nothing and audits nothing', async () => {
    mockEmployeesGet.mockResolvedValueOnce(makeEmployeeSnapshot([
      { id: 'a@example.com', data: { email: 'a@example.com', authUID: 'uid-a', role: 'admin' } },
      { id: 'p@example.com', data: { email: 'p@example.com', authUID: 'uid-p', role: 'partner' } }
    ]));
    mockGetUser
      .mockResolvedValueOnce({ uid: 'uid-a', customClaims: { role: 'admin' } })
      .mockResolvedValueOnce({ uid: 'uid-p', customClaims: { role: 'partner' } });
    const r = await syncRoleClaimsHandler(makeRequest({ data: { apply: true } }));
    expect(r.noChange).toBe(2);
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
    expect(mockLogCriticalAction).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Audit-FIRST per employee
// ════════════════════════════════════════════════════════════════════════════
describe('syncRoleClaimsHandler — audit-FIRST', () => {
  function oneDrift(): void {
    mockEmployeesGet.mockResolvedValueOnce(makeEmployeeSnapshot([
      { id: 'd@example.com', data: { email: 'd@example.com', authUID: 'uid-d', role: 'partner' } }
    ]));
    mockGetUser.mockResolvedValueOnce({ uid: 'uid-d', customClaims: {} });
  }

  it('audit failure ⇒ claim NOT written', async () => {
    oneDrift();
    mockLogCriticalAction.mockRejectedValueOnce(new Error('audit down'));
    const r = await syncRoleClaimsHandler(makeRequest({ data: { apply: true } }));
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
    expect(r.results[0].outcome).toBe('skipped_audit_failed');
  });

  it('audit precedes claim write (ordering)', async () => {
    oneDrift();
    await syncRoleClaimsHandler(makeRequest({ data: { apply: true } }));
    const auditOrder = mockLogCriticalAction.mock.invocationCallOrder[0];
    const claimOrder = mockSetCustomUserClaims.mock.invocationCallOrder[0];
    expect(auditOrder).toBeLessThan(claimOrder);
  });

  it('claim-write failure ⇒ compensating audit', async () => {
    oneDrift();
    mockSetCustomUserClaims.mockRejectedValueOnce(new Error('auth down'));
    const r = await syncRoleClaimsHandler(makeRequest({ data: { apply: true } }));
    expect(r.results[0].outcome).toBe('skipped_claim_failed');
    expect(mockLogCriticalAction).toHaveBeenCalledTimes(2); // original + compensating
  });
});

// ════════════════════════════════════════════════════════════════════════════
// messages.toRoles partner-grant gate
// ════════════════════════════════════════════════════════════════════════════
describe('syncRoleClaimsHandler — messages partner-grant gate', () => {
  function partnerDrift(): void {
    mockEmployeesGet.mockResolvedValueOnce(makeEmployeeSnapshot([
      { id: 'p@example.com', data: { email: 'p@example.com', authUID: 'uid-p', role: 'partner' } }
    ]));
    mockGetUser.mockResolvedValue({ uid: 'uid-p', customClaims: {} });
  }

  it('apply ABORTS when a messages doc has partner in toRoles and no ack', async () => {
    partnerDrift();
    mockMessagesGet.mockImplementation((role: string) => Promise.resolve(messagesSnap(role === 'partner' ? 2 : 0)));
    await expect(syncRoleClaimsHandler(makeRequest({ data: { apply: true } })))
      .rejects.toMatchObject({ code: 'failed-precondition' });
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
  });

  it('apply proceeds with ackMessagesGrant=true', async () => {
    partnerDrift();
    mockMessagesGet.mockImplementation((role: string) => Promise.resolve(messagesSnap(role === 'partner' ? 2 : 0)));
    const r = await syncRoleClaimsHandler(makeRequest({ data: { apply: true, ackMessagesGrant: true } }));
    expect(r.success).toBe(true);
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('uid-p', { role: 'partner' });
    expect(r.messagesProbe.partnerCount).toBe(2);
  });

  it('FAIL-SECURE: apply ABORTS when the probe could not scan (no ack)', async () => {
    partnerDrift();
    mockMessagesGet.mockRejectedValue(new Error('messages query failed'));
    await expect(syncRoleClaimsHandler(makeRequest({ data: { apply: true } })))
      .rejects.toMatchObject({ code: 'failed-precondition' });
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
  });

  it('dry-run is NOT blocked by partner toRoles (read-only)', async () => {
    partnerDrift();
    mockMessagesGet.mockImplementation((role: string) => Promise.resolve(messagesSnap(role === 'partner' ? 2 : 0)));
    const r = await syncRoleClaimsHandler(makeRequest());
    expect(r.mode).toBe('dry-run');
    expect(r.messagesProbe.partnerCount).toBe(2);
  });
});
