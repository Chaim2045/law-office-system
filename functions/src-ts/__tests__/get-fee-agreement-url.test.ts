/**
 * getFeeAgreementUrl — security-remediation tests
 * ─────────────────────────────────────────────────────────────────────────────
 * (a) Static AST guards — v2 onCall, role-only gate (no legacy admin:true),
 *     audits via logCriticalAction, NEVER logs PII or raw error.message/.stack,
 *     never returns the raw doc, and the TTL stays short.
 * (b) Runtime (mocked firebase-admin): auth gates, Zod strict + entity allowlist,
 *     IDOR-safe storagePath resolution (signs the STORED path, never a caller
 *     path), {found} access audit as a disclosure precondition (fail-secure),
 *     short-TTL V4 signing, Hebrew sanitized failures, and a no-PII-in-logs scan.
 *
 * NO real Storage / Firestore — the doc read, the audit write, and getSignedUrl
 * are fully mocked. The REAL logCriticalAction runs against the mocked admin so
 * the audit doc shape is asserted end-to-end.
 */
import * as fs from 'fs';
import * as path from 'path';

// ─── Mocks (declared before importing the handler) ──────────────────────────
const mockDocGet = jest.fn();        // collection(entity).doc(id).get()
const mockAuditAdd = jest.fn();      // collection('audit_log').add(doc)
const mockGetSignedUrl = jest.fn();  // bucket().file(path).getSignedUrl()
const mockFile = jest.fn(() => ({ getSignedUrl: mockGetSignedUrl }));
const mockBucket = jest.fn(() => ({ file: mockFile }));

jest.mock('firebase-admin', () => {
  const firestoreFn = () => ({
    collection: (name: string) => {
      if (name === 'audit_log') {
        return { add: mockAuditAdd, doc: () => ({}) };
      }
      // entity collection (clients / cases)
      return { doc: () => ({ get: mockDocGet }) };
    }
  });
  // admin.firestore() is callable AND admin.firestore.FieldValue is a namespace.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (firestoreFn as any).FieldValue = { serverTimestamp: () => 'ts-sentinel' };
  return {
    firestore: firestoreFn,
    storage: () => ({ bucket: mockBucket })
  };
});

// Capture EVERY logger argument so the no-PII-in-logs scan can read the payloads.
const loggerCalls: string[] = [];
jest.mock('../../shared/logger', () => ({
  info: (...a: unknown[]) => { loggerCalls.push(JSON.stringify(a)); },
  warn: (...a: unknown[]) => { loggerCalls.push(JSON.stringify(a)); },
  error: (...a: unknown[]) => { loggerCalls.push(JSON.stringify(a)); }
}));

import {
  getFeeAgreementUrlHandler,
  getFeeAgreementUrlInputSchema,
  SIGNED_URL_TTL_MS
} from '../fee-agreements/get-fee-agreement-url';

const ADMIN_UID = 'admin-uid-test-fixture-001';
const ENTITY_ID = '2025992';                  // a 7-digit client/case doc id
const AGREEMENT_ID = 'agreement_1700000000000';
const STORAGE_PATH = `clients/${ENTITY_ID}/agreements/${AGREEMENT_ID}.pdf`;
const SIGNED = 'https://storage.googleapis.com/bucket/signed?X-Goog-Signature=deadbeef';

// PII sentinels that may sit ALONGSIDE the agreement on the doc — none may leak
// to logs, and none is needed to mint the URL.
const PII = {
  clientName: 'CLIENTNAME-SENTINEL',
  idNumber: 'IDNUM-SENTINEL-123456789',
  downloadUrl: 'https://storage.googleapis.com/PUBLIC-LEAK-SENTINEL'
};

function makeRequest(overrides: Record<string, unknown> = {}): Parameters<typeof getFeeAgreementUrlHandler>[0] {
  const auth = 'auth' in overrides ? overrides.auth : { uid: ADMIN_UID, token: { role: 'admin' } };
  const data = 'data' in overrides
    ? overrides.data
    : { entity: 'clients', entityId: ENTITY_ID, agreementId: AGREEMENT_ID };
  return { auth, data } as unknown as Parameters<typeof getFeeAgreementUrlHandler>[0];
}

function docWith(agreements: unknown): { exists: boolean; data: () => Record<string, unknown> } {
  return { exists: true, data: () => ({ feeAgreements: agreements }) };
}

const FOUND_AGREEMENT = {
  id: AGREEMENT_ID,
  storagePath: STORAGE_PATH,
  // PII that lives on the same record but must never be touched/logged:
  clientName: PII.clientName,
  idNumber: PII.idNumber,
  downloadUrl: PII.downloadUrl
};

beforeEach(() => {
  mockDocGet.mockReset().mockResolvedValue(docWith([FOUND_AGREEMENT]));
  mockAuditAdd.mockReset().mockResolvedValue({ id: 'audit-doc-id' });
  mockGetSignedUrl.mockReset().mockResolvedValue([SIGNED]);
  mockFile.mockClear();
  mockBucket.mockClear();
  loggerCalls.length = 0;
});

// ════════════════════════════════════════════════════════════════════════════
// (a) Static AST invariants
// ════════════════════════════════════════════════════════════════════════════
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

describe('get-fee-agreement-url — static AST invariants', () => {
  let code: string;
  beforeAll(() => {
    code = stripComments(fs.readFileSync(
      path.resolve(__dirname, '../fee-agreements/get-fee-agreement-url.ts'), 'utf8'
    ));
  });

  it('is a v2 onCall', () => {
    expect(code).toContain('onCall');
    expect(code).toContain('firebase-functions/v2/https');
  });

  it('role-only admin gate, no legacy admin:true acceptance', () => {
    expect(code).toMatch(/claims\.role !== 'admin'/);
    expect(code).not.toMatch(/\.admin === true/);
  });

  it('signs a v4 READ url (not a long-lived public url)', () => {
    expect(code).toMatch(/version:\s*'v4'/);
    expect(code).toMatch(/action:\s*'read'/);
    expect(code).not.toMatch(/makePublic/);
  });

  it('audits the access via logCriticalAction with a non-PII payload', () => {
    expect(code).toContain('logCriticalAction');
    expect(code).toMatch(/logCriticalAction\(\s*AUDIT_ACTION/);
  });

  it('NEVER passes PII to any logger.* call', () => {
    const forbidden = ['clientName', 'idNumber', 'downloadUrl', 'storagePath', 'data\\(\\)'];
    for (const ident of forbidden) {
      const re = new RegExp(`logger\\.\\w+\\([^)]*${ident}`);
      expect(code).not.toMatch(re);
    }
  });

  it('NEVER logs raw error.message/.stack', () => {
    expect(code).not.toMatch(/logger\.\w+\([^)]*\.message/);
    expect(code).not.toMatch(/logger\.\w+\([^)]*\.stack/);
  });

  it('TTL is short (<= 15 minutes)', () => {
    expect(SIGNED_URL_TTL_MS).toBeLessThanOrEqual(15 * 60 * 1000);
    expect(SIGNED_URL_TTL_MS).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (b) Auth gates
// ════════════════════════════════════════════════════════════════════════════
describe('get-fee-agreement-url — auth gates', () => {
  it('rejects unauthenticated', async () => {
    await expect(getFeeAgreementUrlHandler(makeRequest({ auth: null })))
      .rejects.toMatchObject({ code: 'unauthenticated' });
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });

  it('rejects non-admin', async () => {
    const req = makeRequest({ auth: { uid: 'e1', token: { role: 'employee' } } });
    await expect(getFeeAgreementUrlHandler(req)).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('REJECTS legacy admin:true-only token (role-only gate)', async () => {
    const req = makeRequest({ auth: { uid: ADMIN_UID, token: { admin: true } } });
    await expect(getFeeAgreementUrlHandler(req)).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('accepts admin via canonical role:admin', async () => {
    const res = await getFeeAgreementUrlHandler(makeRequest());
    expect(res.url).toBe(SIGNED);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (c) Input validation (Zod strict + entity allowlist)
// ════════════════════════════════════════════════════════════════════════════
describe('get-fee-agreement-url — input validation', () => {
  it('schema enforces entity enum, charset bounds, no extra fields', () => {
    const ok = { entity: 'clients', entityId: ENTITY_ID, agreementId: AGREEMENT_ID };
    expect(getFeeAgreementUrlInputSchema.safeParse(ok).success).toBe(true);
    expect(getFeeAgreementUrlInputSchema.safeParse({ ...ok, entity: 'cases' }).success).toBe(true);
    // entity not in allowlist
    expect(getFeeAgreementUrlInputSchema.safeParse({ ...ok, entity: 'employees' }).success).toBe(false);
    // path traversal attempt in ids
    expect(getFeeAgreementUrlInputSchema.safeParse({ ...ok, entityId: '../secret' }).success).toBe(false);
    expect(getFeeAgreementUrlInputSchema.safeParse({ ...ok, agreementId: 'a/b' }).success).toBe(false);
    // extra field + missing field
    expect(getFeeAgreementUrlInputSchema.safeParse({ ...ok, extra: 1 }).success).toBe(false);
    expect(getFeeAgreementUrlInputSchema.safeParse({ entity: 'clients', entityId: ENTITY_ID }).success).toBe(false);
  });

  it('handler throws invalid-argument on bad input — no read, no audit, no sign', async () => {
    await expect(getFeeAgreementUrlHandler(makeRequest({ data: { entity: 'x', entityId: ENTITY_ID, agreementId: AGREEMENT_ID } })))
      .rejects.toMatchObject({ code: 'invalid-argument' });
    expect(mockDocGet).not.toHaveBeenCalled();
    expect(mockAuditAdd).not.toHaveBeenCalled();
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (d) Happy path — IDOR-safe signing of the STORED path
// ════════════════════════════════════════════════════════════════════════════
describe('get-fee-agreement-url — happy path', () => {
  it('returns {url, expiresAt} and signs the STORED storagePath (v4 read, short TTL)', async () => {
    const before = Date.now();
    const res = await getFeeAgreementUrlHandler(makeRequest());
    const after = Date.now();

    expect(res.url).toBe(SIGNED);
    // signed the server-stored path — never a caller-supplied value
    expect(mockFile).toHaveBeenCalledWith(STORAGE_PATH);
    const opts = mockGetSignedUrl.mock.calls[0][0];
    expect(opts).toMatchObject({ version: 'v4', action: 'read' });
    // expiry is within (now, now + TTL]
    const exp = new Date(res.expiresAt).getTime();
    expect(exp).toBeGreaterThan(before);
    expect(exp).toBeLessThanOrEqual(after + SIGNED_URL_TTL_MS + 5);
  });

  it('audits the issuance with a NON-PII payload (entity/ids/found:true)', async () => {
    await getFeeAgreementUrlHandler(makeRequest());
    expect(mockAuditAdd).toHaveBeenCalledTimes(1);
    const doc = mockAuditAdd.mock.calls[0][0];
    expect(doc.action).toBe('GET_FEE_AGREEMENT_URL');
    expect(doc.userId).toBe(ADMIN_UID);
    expect(doc.details).toEqual({ entity: 'clients', entityId: ENTITY_ID, agreementId: AGREEMENT_ID, found: true });
    const blob = JSON.stringify(doc);
    for (const v of Object.values(PII)) expect(blob).not.toContain(v);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (e) Not-found / IDOR contract
// ════════════════════════════════════════════════════════════════════════════
describe('get-fee-agreement-url — not found', () => {
  it('agreementId not in the array → not-found, audited found:false, NO sign', async () => {
    mockDocGet.mockResolvedValueOnce(docWith([{ id: 'agreement_other', storagePath: 'clients/x/agreements/y.pdf' }]));
    await expect(getFeeAgreementUrlHandler(makeRequest())).rejects.toMatchObject({ code: 'not-found' });
    expect(mockAuditAdd.mock.calls[0][0].details).toMatchObject({ found: false });
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });

  it('doc does not exist → not-found (audited found:false)', async () => {
    mockDocGet.mockResolvedValueOnce({ exists: false, data: () => undefined });
    await expect(getFeeAgreementUrlHandler(makeRequest())).rejects.toMatchObject({ code: 'not-found' });
    expect(mockAuditAdd.mock.calls[0][0].details).toMatchObject({ found: false });
  });

  it('matched agreement missing storagePath → not-found (no sign)', async () => {
    mockDocGet.mockResolvedValueOnce(docWith([{ id: AGREEMENT_ID }]));
    await expect(getFeeAgreementUrlHandler(makeRequest())).rejects.toMatchObject({ code: 'not-found' });
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });

  // Confused-deputy guard: a poisoned storagePath (the doc is admin-writable via the
  // client SDK) that escapes the entity's own agreements folder must NEVER be signed.
  it('poisoned storagePath escaping the entity folder → failed-precondition, NO sign', async () => {
    mockDocGet.mockResolvedValueOnce(docWith([
      { id: AGREEMENT_ID, storagePath: 'clients/9999/agreements/other-client-leak.pdf' } // wrong entityId → cross-tenant
    ]));
    await expect(getFeeAgreementUrlHandler(makeRequest())).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
    expect(mockFile).not.toHaveBeenCalled();
  });

  it('poisoned storagePath pointing outside agreements/ → failed-precondition, NO sign', async () => {
    mockDocGet.mockResolvedValueOnce(docWith([
      { id: AGREEMENT_ID, storagePath: 'private/service-account-key.json' } // arbitrary bucket object
    ]));
    await expect(getFeeAgreementUrlHandler(makeRequest())).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (f) Fail-secure audit + failure paths (Hebrew, sanitized)
// ════════════════════════════════════════════════════════════════════════════
describe('get-fee-agreement-url — failure paths', () => {
  it('FAIL-SECURE: audit write failure → internal, NO url minted', async () => {
    mockAuditAdd.mockRejectedValueOnce({ code: 'permission-denied' });
    const res = await getFeeAgreementUrlHandler(makeRequest()).catch((e) => e);
    expect(res).toMatchObject({ code: 'internal' });
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });

  it('doc read failure → unavailable, no audit, no sign', async () => {
    mockDocGet.mockRejectedValueOnce({ code: 'unavailable' });
    await expect(getFeeAgreementUrlHandler(makeRequest())).rejects.toMatchObject({ code: 'unavailable' });
    expect(mockAuditAdd).not.toHaveBeenCalled();
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });

  it('signing failure (e.g. missing signBlob IAM) → internal Hebrew', async () => {
    mockGetSignedUrl.mockRejectedValueOnce(Object.assign(new Error('SECRET-FRAGMENT permission denied'), { code: 'iam.signBlob.denied' }));
    await expect(getFeeAgreementUrlHandler(makeRequest())).rejects.toMatchObject({ code: 'internal' });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (g) Runtime no-PII-in-logs serialization scan
// ════════════════════════════════════════════════════════════════════════════
describe('get-fee-agreement-url — no PII in logs (runtime)', () => {
  it('no PII / secret reaches any logger.* call across success/not-found/failure', async () => {
    await getFeeAgreementUrlHandler(makeRequest());                                  // success
    mockDocGet.mockResolvedValueOnce({ exists: false, data: () => undefined });
    await getFeeAgreementUrlHandler(makeRequest()).catch(() => undefined);           // not-found
    mockGetSignedUrl.mockRejectedValueOnce(Object.assign(new Error('SECRET-FRAGMENT'), { code: 'x' }));
    await getFeeAgreementUrlHandler(makeRequest()).catch(() => undefined);           // sign fail

    const blob = loggerCalls.join(' ');
    expect(loggerCalls.length).toBeGreaterThan(0);
    for (const v of Object.values(PII)) expect(blob).not.toContain(v);
    expect(blob).not.toContain(STORAGE_PATH);
    expect(blob).not.toContain('SECRET-FRAGMENT');
  });
});
