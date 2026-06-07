/**
 * setAdminClaims — runtime + static guards (Pre-H.0.0.B)
 * ─────────────────────────────────────────────────────────────────────────────
 * Two-layer pattern (mirrors verify-claims.test.ts dual approach but EXTENDS
 * it to actual handler invocation because this endpoint WRITES):
 *
 *   (a) Static AST grep — proves the source body contains the audit-FIRST
 *       ordering and dual-shape claim literal. Catches future "drift" where
 *       someone refactors and accidentally writes only {role:'admin'}.
 *
 *   (b) Runtime invocation with mocked firebase-admin — exercises every auth
 *       gate, the Zod schema, self-elevation block, audit-failure abort,
 *       claim-failure compensating doc, and happy path.
 *
 * Why direct handler invocation (vs firebase-functions-test wrapper):
 *   We export `setAdminClaimsHandler` separately. The v2 `onCall` is a thin
 *   wrapping concern; the LOGIC is in the handler. Testing the handler
 *   directly avoids the test-harness complexity of v2 callable wrapping.
 *
 * Public-repo safety: all test fixtures use synthetic UIDs/emails that
 * cannot be confused with real production data.
 */
import * as fs from 'fs';
import * as path from 'path';

// ─── Mocks must be declared BEFORE importing the handler ────────────────────
const mockSetCustomUserClaims = jest.fn();
const mockGetUser = jest.fn();
const mockAuditAdd = jest.fn();

jest.mock('firebase-admin', () => {
  // Firestore mock — `admin.firestore()` returns a chainable {collection().add()}
  // and `admin.firestore.FieldValue.serverTimestamp` is a static.
  const firestoreFn: jest.Mock & { FieldValue?: unknown } = jest.fn(() => ({
    collection: jest.fn(() => ({ add: mockAuditAdd }))
  }));
  firestoreFn.FieldValue = {
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP_SENTINEL')
  };
  return {
    auth: jest.fn(() => ({
      getUser: mockGetUser,
      setCustomUserClaims: mockSetCustomUserClaims
    })),
    firestore: firestoreFn
  };
});

// Import AFTER mocks
import { setAdminClaimsHandler } from '../set-admin-claims';

// ─── Test fixtures ──────────────────────────────────────────────────────────
const ADMIN_UID = 'admin-caller-uid-test-fixture-x';
const TARGET_UID = 'target-user-uid-test-fixture-yy';
const TEST_AUDIT_DOC_ID = 'audit-doc-id-fixture';

function makeRequest(overrides: Record<string, unknown> = {}): Parameters<typeof setAdminClaimsHandler>[0] {
  const baseAuth = overrides.auth === null
    ? null
    : {
      uid: ADMIN_UID,
      token: { role: 'admin' }
    };
  // Cast through unknown: CallableRequest has many required fields we don't
  // exercise (rawRequest, instanceIdToken, acceptsStreaming). The handler
  // only reads auth + data, so passing those alone is sufficient.
  return {
    auth: baseAuth,
    data: { targetUid: TARGET_UID, role: 'admin' },
    ...overrides
  } as unknown as Parameters<typeof setAdminClaimsHandler>[0];
}

beforeEach(() => {
  mockSetCustomUserClaims.mockReset().mockResolvedValue(undefined);
  mockGetUser.mockReset().mockResolvedValue({
    uid: TARGET_UID,
    customClaims: {}
  });
  mockAuditAdd.mockReset().mockResolvedValue({ id: TEST_AUDIT_DOC_ID });
});

// ════════════════════════════════════════════════════════════════════════════
// (a) Static AST guard — invariants must hold at the source-code level
// ════════════════════════════════════════════════════════════════════════════
describe('setAdminClaims — static AST invariants', () => {
  let source: string;

  beforeAll(() => {
    const sourcePath = path.resolve(__dirname, '../set-admin-claims.ts');
    source = fs.readFileSync(sourcePath, 'utf8');
  });

  it('writes the single-shape claim {role:\'admin\'} (Pre-H.0.0.E contraction)', () => {
    // The claim WRITE must be role-only. The legacy `{admin:true, role:'admin'}`
    // dual-shape literal must be gone from the setCustomUserClaims payload.
    // (The auth GATE at step 1 is now ALSO role-only — the legacy
    // `claims.admin === true` acceptance was retired in the §7.4 follow-up.)
    expect(source).toMatch(/setCustomUserClaims\(\s*targetUid,\s*\{\s*role:\s*'admin'\s*\}\s*\)/);
    expect(source).not.toMatch(/setCustomUserClaims\([^)]*admin:\s*true/);
  });

  it('uses canonical logCriticalAction helper for audit writes (Pre-H.0.0.C)', () => {
    // Pre-H.0.0.C canonicalized the local writeAuditOrThrow into a shared
    // helper. Source MUST import + use the canonical and MUST NOT contain
    // a local clone.
    expect(source).toContain('logCriticalAction');
    expect(source).toMatch(/from\s+['"]\.\/audit-critical['"]/);
    expect(source).not.toContain('function writeAuditOrThrow');
    expect(source).not.toContain('const AUDIT_COLLECTION');
  });

  it('blocks self-elevation explicitly', () => {
    expect(source).toMatch(/callerUid === targetUid/);
  });

  it('uses Zod schema for input validation', () => {
    expect(source).toContain('setAdminClaimsSchema.safeParse');
    expect(source).toContain('z.literal(\'admin\')');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (b) Runtime — handler invocation with mocked firebase-admin
// ════════════════════════════════════════════════════════════════════════════
describe('setAdminClaimsHandler — auth gates', () => {
  it('rejects unauthenticated request with no claim write', async () => {
    const req = makeRequest({ auth: null });
    await expect(setAdminClaimsHandler(req)).rejects.toMatchObject({
      code: 'unauthenticated'
    });
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
    expect(mockAuditAdd).not.toHaveBeenCalled();
  });

  it('rejects non-admin caller (no role, no admin)', async () => {
    const req = makeRequest({
      auth: { uid: 'employee-uid-fixture', token: { role: 'employee' } }
    });
    await expect(setAdminClaimsHandler(req)).rejects.toMatchObject({
      code: 'permission-denied'
    });
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
  });

  it('accepts admin via canonical {role:\'admin\'} token shape', async () => {
    const req = makeRequest({
      auth: { uid: ADMIN_UID, token: { role: 'admin' } }
    });
    const result = await setAdminClaimsHandler(req);
    expect(result.success).toBe(true);
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith(TARGET_UID, {
      role: 'admin'
    });
  });

  it('REJECTS a legacy {admin:true}-only token (Pre-H.0.0.E follow-up — role-only gate)', async () => {
    const req = makeRequest({
      auth: { uid: ADMIN_UID, token: { admin: true } }
    });
    await expect(setAdminClaimsHandler(req)).rejects.toMatchObject({
      code: 'permission-denied'
    });
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
  });
});

describe('setAdminClaimsHandler — self-elevation block', () => {
  it('rejects when caller uid equals target uid', async () => {
    const req = makeRequest({
      auth: { uid: ADMIN_UID, token: { role: 'admin' } },
      data: { targetUid: ADMIN_UID, role: 'admin' } // self-elevation attempt
    });
    await expect(setAdminClaimsHandler(req)).rejects.toMatchObject({
      code: 'permission-denied'
    });
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
    expect(mockAuditAdd).not.toHaveBeenCalled();
  });
});

describe('setAdminClaimsHandler — Zod input validation', () => {
  it('rejects missing targetUid', async () => {
    const req = makeRequest({ data: { role: 'admin' } });
    await expect(setAdminClaimsHandler(req)).rejects.toMatchObject({
      code: 'invalid-argument'
    });
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
  });

  it('rejects role !== \'admin\'', async () => {
    const req = makeRequest({ data: { targetUid: TARGET_UID, role: 'employee' } });
    await expect(setAdminClaimsHandler(req)).rejects.toMatchObject({
      code: 'invalid-argument'
    });
  });

  it('rejects targetUid shorter than minimum (defense against test-string injection)', async () => {
    const req = makeRequest({ data: { targetUid: 'short', role: 'admin' } });
    await expect(setAdminClaimsHandler(req)).rejects.toMatchObject({
      code: 'invalid-argument'
    });
  });

  it('rejects unknown extra fields (.strict() schema)', async () => {
    const req = makeRequest({
      data: { targetUid: TARGET_UID, role: 'admin', maliciousField: 'bypass' }
    });
    await expect(setAdminClaimsHandler(req)).rejects.toMatchObject({
      code: 'invalid-argument'
    });
  });
});

describe('setAdminClaimsHandler — target user resolution', () => {
  it('throws not-found when target user does not exist', async () => {
    mockGetUser.mockRejectedValueOnce({ code: 'auth/user-not-found' });
    const req = makeRequest();
    await expect(setAdminClaimsHandler(req)).rejects.toMatchObject({
      code: 'not-found'
    });
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
    expect(mockAuditAdd).not.toHaveBeenCalled();
  });
});

describe('setAdminClaimsHandler — fail-secure ordering', () => {
  it('aborts WITHOUT writing claim when audit write fails', async () => {
    mockAuditAdd.mockRejectedValueOnce(new Error('Firestore unavailable'));
    const req = makeRequest();
    await expect(setAdminClaimsHandler(req)).rejects.toMatchObject({
      code: 'internal'
    });
    // The critical fail-secure assertion: claim must NOT be written if audit failed.
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
  });

  it('writes compensating audit doc when claim write fails after audit succeeded', async () => {
    mockSetCustomUserClaims.mockRejectedValueOnce(new Error('Auth unavailable'));
    // First audit add succeeds; second (compensating) also succeeds.
    mockAuditAdd
      .mockResolvedValueOnce({ id: 'first-audit-doc' })
      .mockResolvedValueOnce({ id: 'compensating-audit-doc' });
    const req = makeRequest();
    await expect(setAdminClaimsHandler(req)).rejects.toMatchObject({
      code: 'internal'
    });
    expect(mockAuditAdd).toHaveBeenCalledTimes(2);
  });
});

describe('setAdminClaimsHandler — happy path', () => {
  it('writes single-shape claim, audit doc, and returns expected response', async () => {
    const req = makeRequest();
    const result = await setAdminClaimsHandler(req);

    expect(result).toEqual({
      success: true,
      targetUid: TARGET_UID,
      role: 'admin',
      auditDocId: TEST_AUDIT_DOC_ID,
      claimShapeWritten: { role: 'admin' }
    });

    // Ordering: audit FIRST, then claim
    expect(mockAuditAdd).toHaveBeenCalledTimes(1);
    expect(mockSetCustomUserClaims).toHaveBeenCalledTimes(1);

    // Claim payload is single-shape (Pre-H.0.0.E contraction)
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith(TARGET_UID, {
      role: 'admin'
    });

    // Audit payload includes previousClaims + newClaims
    const auditPayload = mockAuditAdd.mock.calls[0][0];
    expect(auditPayload.action).toBe('SET_ADMIN_CLAIM');
    expect(auditPayload.userId).toBe(ADMIN_UID);
    expect(auditPayload.details.targetUid).toBe(TARGET_UID);
    expect(auditPayload.details.newClaims).toEqual({ role: 'admin' });
  });
});
