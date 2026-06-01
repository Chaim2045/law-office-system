/**
 * tofesMecherConnectivityCheck + getTofesMecherApp — H.0 guards
 * ─────────────────────────────────────────────────────────────────────────────
 * (a) Static AST guards — the source must never log key material or raw
 *     error.message/.stack (devils-advocate Attack #2 PUBLIC-log leak).
 * (b) Runtime — mocked firebase-admin: auth gates, credential-error sanitization,
 *     reachability read, no-key-in-logs (runtime serialization scan), happy path.
 *
 * NO real cross-project call — the named-app + firestore are fully mocked.
 */
import * as fs from 'fs';
import * as path from 'path';

// ─── Mocks (declared before importing the handler) ──────────────────────────
const mockFirestoreGet = jest.fn();
const mockInitializeApp = jest.fn();
const mockAppLookup = jest.fn();
const mockCert = jest.fn();

jest.mock('firebase-admin', () => {
  const firestore = () => ({
    collection: () => ({ limit: () => ({ get: mockFirestoreGet }) })
  });
  return {
    app: (name: string) => mockAppLookup(name),
    initializeApp: (...args: unknown[]) => {
      mockInitializeApp(...args);
      return { firestore };
    },
    credential: { cert: (...args: unknown[]) => mockCert(...args) }
  };
});

// defineSecret returns an object with .value(); stub the params module.
jest.mock('firebase-functions/params', () => ({
  defineSecret: (name: string) => ({ name, value: () => '{"fake":"sa-key"}' })
}));

// Capture EVERY argument passed to the logger so the no-key-in-logs runtime
// test can scan the serialized payloads. (jest.spyOn can't redefine the CJS
// logger's non-configurable named exports, so we mock the module instead.)
const loggerCalls: string[] = [];
jest.mock('../../shared/logger', () => ({
  info: (...a: unknown[]) => { loggerCalls.push(JSON.stringify(a)); },
  warn: (...a: unknown[]) => { loggerCalls.push(JSON.stringify(a)); },
  error: (...a: unknown[]) => { loggerCalls.push(JSON.stringify(a)); }
}));

import { connectivityCheckHandler } from '../tofes-mecher/connectivity-check';
import { getTofesMecherApp, __resetTofesMecherAppForTests, TofesMecherCredentialError } from '../tofes-mecher/app';

const ADMIN_UID = 'admin-uid-test-fixture-001';
const VALID_SA_JSON = JSON.stringify({ project_id: 'x', private_key: 'fake', client_email: 'a@b.iam' });

function makeRequest(overrides: Record<string, unknown> = {}): Parameters<typeof connectivityCheckHandler>[0] {
  const auth = overrides.auth === null ? null : { uid: ADMIN_UID, token: { role: 'admin' } };
  return { auth, data: {}, ...overrides } as unknown as Parameters<typeof connectivityCheckHandler>[0];
}

beforeEach(() => {
  __resetTofesMecherAppForTests();
  mockFirestoreGet.mockReset().mockResolvedValue({ empty: false });
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

describe('connectivity-check — static AST invariants', () => {
  let code: string;
  let appCode: string;

  beforeAll(() => {
    code = stripComments(fs.readFileSync(path.resolve(__dirname, '../tofes-mecher/connectivity-check.ts'), 'utf8'));
    appCode = stripComments(fs.readFileSync(path.resolve(__dirname, '../tofes-mecher/app.ts'), 'utf8'));
  });

  it('is a v2 onCall declaring the secret', () => {
    expect(code).toContain('onCall');
    expect(code).toMatch(/secrets:\s*\[TOFES_KEY\]/);
  });

  it('uses logger, NOT logCriticalAction (read-only, G3 N/A)', () => {
    expect(code).not.toContain('logCriticalAction');
  });

  it('NEVER logs raw error.message or error.stack (Attack #2 leak guard)', () => {
    expect(code).not.toMatch(/logger\.\w+\([^)]*\.message/);
    expect(code).not.toMatch(/logger\.\w+\([^)]*\.stack/);
    expect(code).not.toMatch(/logger\.\w+\([^)]*\.value\(\)/);
  });

  it('NEVER logs the secret value / SA key', () => {
    expect(code).not.toMatch(/logger\.\w+\([^)]*TOFES_KEY/);
    expect(code).not.toMatch(/logger\.\w+\([^)]*saKeyJson/);
  });

  it('app.ts re-throws a sanitized credential error (no input fragment)', () => {
    expect(appCode).toContain('TofesMecherCredentialError');
    // The catch around JSON.parse must NOT re-include the original error.
    expect(appCode).toMatch(/catch\s*\{\s*[\s\S]*throw new TofesMecherCredentialError/);
  });

  it('app.ts uses a module-level singleton, not try/catch-as-control-flow init', () => {
    expect(appCode).toContain('let cachedApp');
    expect(appCode).toMatch(/if\s*\(cachedApp\)/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (b) getTofesMecherApp — credential safety + singleton
// ════════════════════════════════════════════════════════════════════════════
describe('getTofesMecherApp — credential + singleton', () => {
  it('initializes the named app with the parsed credential', () => {
    getTofesMecherApp(VALID_SA_JSON);
    expect(mockCert).toHaveBeenCalledTimes(1);
    expect(mockInitializeApp).toHaveBeenCalledTimes(1);
    // second arg is the named-app name
    expect(mockInitializeApp.mock.calls[0][1]).toBe('tofes-mecher');
  });

  it('caches the app — second call does NOT re-init (singleton, Attack #1)', () => {
    getTofesMecherApp(VALID_SA_JSON);
    getTofesMecherApp(VALID_SA_JSON);
    expect(mockInitializeApp).toHaveBeenCalledTimes(1);
  });

  it('throws a SANITIZED error on malformed key — no input fragment', () => {
    expect(() => getTofesMecherApp('{ this is not valid json')).toThrow(TofesMecherCredentialError);
    // The sanitized error message must NOT contain any of the input.
    try {
      getTofesMecherApp('SECRET-FRAGMENT-12345');
    } catch (e) {
      expect((e as Error).message).toBe('tofes-mecher credential init failed');
      expect((e as Error).message).not.toContain('SECRET-FRAGMENT');
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (c) connectivityCheckHandler — auth gates
// ════════════════════════════════════════════════════════════════════════════
describe('connectivityCheckHandler — auth gates', () => {
  it('rejects unauthenticated', async () => {
    await expect(connectivityCheckHandler(makeRequest({ auth: null })))
      .rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('rejects non-admin', async () => {
    const req = makeRequest({ auth: { uid: 'e1', token: { role: 'employee' } } });
    await expect(connectivityCheckHandler(req)).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('accepts admin via canonical role:admin', async () => {
    const res = await connectivityCheckHandler(makeRequest());
    expect(res.ok).toBe(true);
    expect(res.reachable).toBe(true);
  });

  it('accepts admin via legacy admin:true (dual-shape gate)', async () => {
    const req = makeRequest({ auth: { uid: ADMIN_UID, token: { admin: true } } });
    const res = await connectivityCheckHandler(req);
    expect(res.ok).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (d) reachability + result
// ════════════════════════════════════════════════════════════════════════════
describe('connectivityCheckHandler — reachability', () => {
  it('sawAtLeastOneDoc=true when collection returns a doc', async () => {
    mockFirestoreGet.mockResolvedValueOnce({ empty: false });
    const res = await connectivityCheckHandler(makeRequest());
    expect(res.sawAtLeastOneDoc).toBe(true);
  });

  it('sawAtLeastOneDoc=false when collection is empty (still ok/reachable)', async () => {
    mockFirestoreGet.mockResolvedValueOnce({ empty: true });
    const res = await connectivityCheckHandler(makeRequest());
    expect(res).toEqual({ ok: true, reachable: true, sawAtLeastOneDoc: false });
  });

  it('throws Hebrew unavailable when the read fails', async () => {
    mockFirestoreGet.mockRejectedValueOnce({ code: 'permission-denied' });
    await expect(connectivityCheckHandler(makeRequest())).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('throws Hebrew internal when credential init fails', async () => {
    // Force the cert step to throw → getTofesMecherApp throws sanitized.
    mockCert.mockImplementationOnce(() => { throw new Error('bad cert'); });
    await expect(connectivityCheckHandler(makeRequest())).rejects.toMatchObject({ code: 'internal' });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (e) runtime no-key-in-logs (Attack #2 — serialize logged args, scan)
// ════════════════════════════════════════════════════════════════════════════
describe('connectivityCheckHandler — no key/PII in logs (runtime)', () => {
  it('does not pass the SA key or a raw error message to any logger call', async () => {
    // success path
    await connectivityCheckHandler(makeRequest());
    // failure path (read fails)
    mockFirestoreGet.mockRejectedValueOnce({ code: 'x' });
    await connectivityCheckHandler(makeRequest()).catch(() => undefined);
    // credential failure path — a raw thrown message that must NOT reach logs
    mockCert.mockImplementationOnce(() => { throw new Error('SECRET-FRAGMENT-99'); });
    await connectivityCheckHandler(makeRequest()).catch(() => undefined);

    const blob = loggerCalls.join(' ');
    expect(loggerCalls.length).toBeGreaterThan(0); // sanity: logging happened
    expect(blob).not.toContain('sa-key'); // the fake secret value from the params mock
    expect(blob).not.toContain('SECRET-FRAGMENT'); // a raw thrown message
  });
});
