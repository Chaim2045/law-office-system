/**
 * validateSalesRecordExists — Phase 2 H.1.b tests
 * ─────────────────────────────────────────────────────────────────────────────
 * (a) Static AST guards — the source must never log PII (idNumber/clientName/
 *     amounts/contact) or key material / raw error.message, and MUST audit.
 * (b) Runtime (mocked firebase-admin): auth gates, Zod strict, field
 *     minimization (exactly 9 keys, no contact PII), {exists:false} contract,
 *     the non-PII access audit as a disclosure precondition (fail-secure),
 *     Timestamp→ISO, sanitized credential errors, and a runtime no-PII-in-logs
 *     serialization scan.
 *
 * Also re-establishes the `app.ts` credential/singleton coverage that moved here
 * from the deleted connectivity-check.test.ts (app.ts's sole test consumer).
 *
 * NO real cross-project call — the named app, both firestores, and the audit
 * write are fully mocked.
 */
import * as fs from 'fs';
import * as path from 'path';

// ─── Mocks (declared before importing the handler) ──────────────────────────
const mockReadGet = jest.fn();      // the tofes-mecher doc read: .doc(id).get()
const mockAuditAdd = jest.fn();     // the audit_log .add(doc) write
const mockInitializeApp = jest.fn();
const mockAppLookup = jest.fn();
const mockCert = jest.fn();

jest.mock('firebase-admin', () => {
  // Named-app firestore (the cross-project read path).
  const namedFirestore = () => ({
    collection: () => ({ doc: () => ({ get: mockReadGet }) })
  });
  // Default-app firestore (the audit_log write path, via logCriticalAction).
  const defaultFirestore = () => ({
    collection: () => ({ add: mockAuditAdd, doc: () => ({}) })
  });
  // admin.firestore() is a function AND admin.firestore.FieldValue is a namespace.
  const firestoreFn = (...args: unknown[]) => defaultFirestore(...(args as []));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (firestoreFn as any).FieldValue = { serverTimestamp: () => 'ts-sentinel' };
  return {
    app: (name: string) => mockAppLookup(name),
    initializeApp: (...args: unknown[]) => {
      mockInitializeApp(...args);
      return { firestore: namedFirestore };
    },
    credential: { cert: (...args: unknown[]) => mockCert(...args) },
    firestore: firestoreFn
  };
});

// defineSecret returns an object with .value(); stub the params module.
jest.mock('firebase-functions/params', () => ({
  defineSecret: (name: string) => ({
    name,
    // A fake SA key — includes the tofes-mecher project_id so the app.ts
    // wrong-project circuit-breaker (added by the read-only PR) passes.
    value: () => '{"project_id":"law-office-sales-form","fake":"sa-key"}'
  })
}));

// Capture EVERY argument passed to the logger so the no-PII-in-logs runtime test
// can scan the serialized payloads.
const loggerCalls: string[] = [];
jest.mock('../../shared/logger', () => ({
  info: (...a: unknown[]) => { loggerCalls.push(JSON.stringify(a)); },
  warn: (...a: unknown[]) => { loggerCalls.push(JSON.stringify(a)); },
  error: (...a: unknown[]) => { loggerCalls.push(JSON.stringify(a)); }
}));

import {
  validateSalesRecordExistsHandler,
  validateSalesRecordInputSchema
} from '../tofes-mecher/validate-sales-record';
import {
  getTofesMecherApp,
  getTofesMecherReader,
  __resetTofesMecherAppForTests,
  TofesMecherCredentialError
} from '../tofes-mecher/app';

const ADMIN_UID = 'admin-uid-test-fixture-001';
const VALID_ID = 'AbCdEf0123456789wxyz'; // 20-char auto-id shape

// Sentinel PII values — the runtime scan asserts NONE of these reach logger.*.
const PII = {
  idNumber: 'IDNUM-SENTINEL-123456789',
  clientName: 'CLIENTNAME-SENTINEL',
  phone: 'PHONE-SENTINEL',
  email: 'EMAIL-SENTINEL',
  address: 'ADDRESS-SENTINEL'
};

function makeRequest(overrides: Record<string, unknown> = {}): Parameters<typeof validateSalesRecordExistsHandler>[0] {
  // 'auth' in overrides → honor it verbatim (incl. null for unauth, or a
  // non-admin/legacy token). Otherwise default to a valid admin caller.
  const auth = 'auth' in overrides ? overrides.auth : { uid: ADMIN_UID, token: { role: 'admin' } };
  const data = 'data' in overrides ? overrides.data : { salesRecordId: VALID_ID };
  return { auth, data } as unknown as Parameters<typeof validateSalesRecordExistsHandler>[0];
}

function foundDoc(extra: Record<string, unknown> = {}) {
  return {
    exists: true,
    data: () => ({
      ...PII,
      amountBeforeVat: 1000,
      vatAmount: 170,
      amountWithVat: 1170,
      amount: 1170,
      transactionType: 'ייעוץ',
      timestamp: { toDate: () => new Date('2026-01-02T03:04:05.000Z') },
      // an UNREQUESTED field that must NOT appear in the response (minimization)
      clientId: 'TOFES-INTERNAL-ID',
      ...extra
    })
  };
}

beforeEach(() => {
  __resetTofesMecherAppForTests();
  mockReadGet.mockReset().mockResolvedValue(foundDoc());
  mockAuditAdd.mockReset().mockResolvedValue({ id: 'audit-doc-id' });
  mockInitializeApp.mockReset();
  mockAppLookup.mockReset().mockImplementation(() => { throw new Error('app/no-app'); });
  mockCert.mockReset().mockReturnValue({ __cred: true });
  loggerCalls.length = 0;
});

// ════════════════════════════════════════════════════════════════════════════
// (a) Static AST invariants
// ════════════════════════════════════════════════════════════════════════════
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

describe('validate-sales-record — static AST invariants', () => {
  let code: string;
  beforeAll(() => {
    code = stripComments(fs.readFileSync(
      path.resolve(__dirname, '../tofes-mecher/validate-sales-record.ts'), 'utf8'
    ));
  });

  it('is a v2 onCall declaring the secret', () => {
    expect(code).toContain('onCall');
    expect(code).toMatch(/secrets:\s*\[TOFES_KEY\]/);
  });

  it('role-only admin gate, rejects non-admin (no legacy admin:true acceptance)', () => {
    expect(code).toMatch(/claims\.role !== 'admin'/);
    expect(code).not.toMatch(/\.admin === true/);
  });

  it('audits the access via logCriticalAction (non-PII payload)', () => {
    expect(code).toContain('logCriticalAction');
    expect(code).toMatch(/logCriticalAction\([^)]*salesRecordId,\s*found/);
  });

  it('NEVER passes PII to any logger.* call (idNumber/clientName/amounts/contact)', () => {
    const forbidden = [
      'idNumber', 'clientName', 'amountBeforeVat', 'vatAmount',
      'amountWithVat', 'amount', 'phone', 'email', 'address', 'snap.data'
    ];
    for (const ident of forbidden) {
      const re = new RegExp(`logger\\.\\w+\\([^)]*${ident.replace('.', '\\.')}`);
      expect(code).not.toMatch(re);
    }
  });

  it('NEVER logs raw error.message/.stack or the secret value', () => {
    expect(code).not.toMatch(/logger\.\w+\([^)]*\.message/);
    expect(code).not.toMatch(/logger\.\w+\([^)]*\.stack/);
    expect(code).not.toMatch(/logger\.\w+\([^)]*\.value\(\)/);
    expect(code).not.toMatch(/logger\.\w+\([^)]*TOFES_KEY/);
  });

  it('never returns snap.data() directly (allowlist projection only)', () => {
    expect(code).not.toMatch(/return\s+snap\.data\(\)/);
    expect(code).not.toMatch(/return\s*\{\s*\.\.\.\s*data\s*\}/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (b) getTofesMecherApp — credential + singleton (migrated from connectivity test)
// ════════════════════════════════════════════════════════════════════════════
describe('getTofesMecherApp — credential + singleton', () => {
  // project_id MUST be the tofes-mecher project — the wrong-project
  // circuit-breaker asserts on the KEY's own project_id.
  const VALID_SA_JSON = JSON.stringify({
    project_id: 'law-office-sales-form',
    private_key: 'fake',
    client_email: 'a@b.iam'
  });

  it('initializes the named app with the parsed credential', () => {
    getTofesMecherApp(VALID_SA_JSON);
    expect(mockCert).toHaveBeenCalledTimes(1);
    expect(mockInitializeApp).toHaveBeenCalledTimes(1);
    expect(mockInitializeApp.mock.calls[0][1]).toBe('tofes-mecher');
  });

  it('caches the app — second call does NOT re-init (singleton)', () => {
    getTofesMecherApp(VALID_SA_JSON);
    getTofesMecherApp(VALID_SA_JSON);
    expect(mockInitializeApp).toHaveBeenCalledTimes(1);
  });

  it('throws a SANITIZED error on malformed key — no input fragment', () => {
    expect(() => getTofesMecherApp('{ not valid json')).toThrow(TofesMecherCredentialError);
    try {
      getTofesMecherApp('SECRET-FRAGMENT-12345');
    } catch (e) {
      expect((e as Error).message).toBe('tofes-mecher credential init failed');
      expect((e as Error).message).not.toContain('SECRET-FRAGMENT');
    }
  });

  it('CIRCUIT-BREAKER: refuses a well-formed key whose project_id is NOT tofes-mecher', () => {
    // A syntactically valid key for the WRONG project (e.g. the MAIN project, or
    // any rotated key). Fail-CLOSED at init — never authenticate as the wrong
    // principal against tofes Firestore. This is the load-bearing check that an
    // `app.options.projectId` assertion (a tautology) could never catch.
    const WRONG_PROJECT_KEY = JSON.stringify({
      project_id: 'law-office-system-e4801',
      private_key: 'fake',
      client_email: 'a@b.iam'
    });
    expect(() => getTofesMecherApp(WRONG_PROJECT_KEY)).toThrow(TofesMecherCredentialError);
    // NEVER reaches cert()/initializeApp when the project is wrong.
    expect(mockCert).not.toHaveBeenCalled();
    expect(mockInitializeApp).not.toHaveBeenCalled();
  });

  it('getTofesMecherReader exposes ONLY read methods (no write surface)', () => {
    const reader = getTofesMecherReader(VALID_SA_JSON);
    expect(typeof reader.readDoc).toBe('function');
    expect(typeof reader.readCollection).toBe('function');
    // The reader is a frozen, read-only surface — no write method is reachable.
    for (const writeMethod of ['set', 'update', 'delete', 'add', 'batch', 'create']) {
      expect((reader as unknown as Record<string, unknown>)[writeMethod]).toBeUndefined();
    }
    expect(Object.isFrozen(reader)).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (c) Auth gates
// ════════════════════════════════════════════════════════════════════════════
describe('validateSalesRecordExists — auth gates', () => {
  it('rejects unauthenticated', async () => {
    await expect(validateSalesRecordExistsHandler(makeRequest({ auth: null })))
      .rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('rejects non-admin', async () => {
    const req = makeRequest({ auth: { uid: 'e1', token: { role: 'employee' } } });
    await expect(validateSalesRecordExistsHandler(req)).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('REJECTS legacy admin:true-only token (role-only gate)', async () => {
    const req = makeRequest({ auth: { uid: ADMIN_UID, token: { admin: true } } });
    await expect(validateSalesRecordExistsHandler(req)).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('accepts admin via canonical role:admin', async () => {
    const res = await validateSalesRecordExistsHandler(makeRequest());
    expect(res.exists).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (d) Input validation (Zod strict)
// ════════════════════════════════════════════════════════════════════════════
describe('validateSalesRecordExists — input validation', () => {
  it('schema rejects wrong-length / non-alphanumeric / extra-field / missing', () => {
    expect(validateSalesRecordInputSchema.safeParse({ salesRecordId: 'tooshort' }).success).toBe(false);
    expect(validateSalesRecordInputSchema.safeParse({ salesRecordId: 'AbCdEf0123456789wxy/' }).success).toBe(false);
    expect(validateSalesRecordInputSchema.safeParse({ salesRecordId: VALID_ID, extra: 1 }).success).toBe(false);
    expect(validateSalesRecordInputSchema.safeParse({}).success).toBe(false);
    expect(validateSalesRecordInputSchema.safeParse({ salesRecordId: VALID_ID }).success).toBe(true);
  });

  it('handler throws invalid-argument on a malformed id', async () => {
    await expect(validateSalesRecordExistsHandler(makeRequest({ data: { salesRecordId: 'bad' } })))
      .rejects.toMatchObject({ code: 'invalid-argument' });
    // no read, no audit on a rejected input
    expect(mockReadGet).not.toHaveBeenCalled();
    expect(mockAuditAdd).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (e) Found → field-minimized projection + Timestamp transform
// ════════════════════════════════════════════════════════════════════════════
describe('validateSalesRecordExists — found projection', () => {
  it('returns EXACTLY the 9-field minimized shape (no contact/instrument PII)', async () => {
    const res = await validateSalesRecordExistsHandler(makeRequest());
    expect(res).toEqual({
      exists: true,
      salesRecordId: VALID_ID,
      clientName: PII.clientName,
      idNumber: PII.idNumber,
      amountBeforeVat: 1000,
      vatAmount: 170,
      amountWithVat: 1170,
      amount: 1170,
      transactionType: 'ייעוץ',
      timestampIso: '2026-01-02T03:04:05.000Z'
    });
    // minimization: excluded PII / internal fields are absent from the response
    expect(Object.keys(res)).not.toContain('phone');
    expect(Object.keys(res)).not.toContain('email');
    expect(Object.keys(res)).not.toContain('address');
    expect(Object.keys(res)).not.toContain('clientId');
  });

  it('absent strings → "" and absent amounts → null (0 stays 0)', async () => {
    mockReadGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ amountBeforeVat: 0 }) // everything else absent
    });
    const res = await validateSalesRecordExistsHandler(makeRequest());
    expect(res).toMatchObject({
      exists: true,
      clientName: '',
      idNumber: '',
      amountBeforeVat: 0,        // a valid zero fee, NOT null
      vatAmount: null,
      amount: null,
      transactionType: '',
      timestampIso: null
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (f) Not-found contract
// ════════════════════════════════════════════════════════════════════════════
describe('validateSalesRecordExists — not found', () => {
  it('returns {exists:false, salesRecordId} (does NOT throw)', async () => {
    mockReadGet.mockResolvedValueOnce({ exists: false });
    const res = await validateSalesRecordExistsHandler(makeRequest());
    expect(res).toEqual({ exists: false, salesRecordId: VALID_ID });
  });

  it('emits a divergence warn on not-found (mirror/live)', async () => {
    mockReadGet.mockResolvedValueOnce({ exists: false });
    await validateSalesRecordExistsHandler(makeRequest());
    expect(loggerCalls.join(' ')).toContain('tofes_mecher.validate.not_found');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (g) Non-PII access audit — disclosure precondition (fail-secure)
// ════════════════════════════════════════════════════════════════════════════
describe('validateSalesRecordExists — access audit', () => {
  it('audits every lookup with a NON-PII payload (salesRecordId + found)', async () => {
    await validateSalesRecordExistsHandler(makeRequest());
    expect(mockAuditAdd).toHaveBeenCalledTimes(1);
    const doc = mockAuditAdd.mock.calls[0][0];
    expect(doc.action).toBe('VALIDATE_SALES_RECORD');
    expect(doc.userId).toBe(ADMIN_UID);
    expect(doc.details).toEqual({ salesRecordId: VALID_ID, found: true });
    // the audit payload carries NO PII
    const blob = JSON.stringify(doc);
    for (const v of Object.values(PII)) expect(blob).not.toContain(v);
  });

  it('audits not-found too (found:false)', async () => {
    mockReadGet.mockResolvedValueOnce({ exists: false });
    await validateSalesRecordExistsHandler(makeRequest());
    expect(mockAuditAdd.mock.calls[0][0].details).toEqual({ salesRecordId: VALID_ID, found: false });
  });

  it('FAIL-SECURE: audit write failure → throws internal, NO PII disclosed', async () => {
    mockAuditAdd.mockRejectedValueOnce({ code: 'permission-denied' });
    const res = await validateSalesRecordExistsHandler(makeRequest()).catch((e) => e);
    expect(res).toMatchObject({ code: 'internal' });
    // the PII record was NOT returned
    expect(res.exists).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (h) Credential / read failure paths (Hebrew, sanitized)
// ════════════════════════════════════════════════════════════════════════════
describe('validateSalesRecordExists — failure paths', () => {
  it('throws Hebrew internal when credential init fails', async () => {
    mockCert.mockImplementationOnce(() => { throw new Error('bad cert'); });
    await expect(validateSalesRecordExistsHandler(makeRequest())).rejects.toMatchObject({ code: 'internal' });
  });

  it('throws Hebrew unavailable when the read fails', async () => {
    mockReadGet.mockRejectedValueOnce({ code: 'permission-denied' });
    await expect(validateSalesRecordExistsHandler(makeRequest())).rejects.toMatchObject({ code: 'unavailable' });
    // read failed → no audit, no disclosure
    expect(mockAuditAdd).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (i) Runtime no-PII-in-logs serialization scan
// ════════════════════════════════════════════════════════════════════════════
describe('validateSalesRecordExists — no PII in logs (runtime)', () => {
  it('no PII value reaches any logger.* call across success/not-found/failure', async () => {
    await validateSalesRecordExistsHandler(makeRequest());                       // found
    mockReadGet.mockResolvedValueOnce({ exists: false });
    await validateSalesRecordExistsHandler(makeRequest());                       // not found
    mockReadGet.mockRejectedValueOnce({ code: 'x' });
    await validateSalesRecordExistsHandler(makeRequest()).catch(() => undefined);// read fail
    mockCert.mockImplementationOnce(() => { throw new Error('SECRET-FRAGMENT-9'); });
    await validateSalesRecordExistsHandler(makeRequest()).catch(() => undefined);// cred fail

    const blob = loggerCalls.join(' ');
    expect(loggerCalls.length).toBeGreaterThan(0);
    for (const v of Object.values(PII)) expect(blob).not.toContain(v);
    expect(blob).not.toContain('sa-key');          // the fake secret value
    expect(blob).not.toContain('SECRET-FRAGMENT');  // a raw thrown message
  });
});
