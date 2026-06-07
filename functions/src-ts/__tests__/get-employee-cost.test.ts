/**
 * getEmployeeCost — runtime + static guards (Pre-H.0.0.G)
 * ─────────────────────────────────────────────────────────────────────────────
 * (a) static AST guards, (b) runtime invocation with mocked firebase-admin.
 * Read-only callable — admin-gated, NO self-read carve-out.
 */
import * as fs from 'fs';
import * as path from 'path';

const mockCostGet = jest.fn();

jest.mock('firebase-admin', () => {
  const firestoreFn: jest.Mock = jest.fn(() => ({
    collection: () => ({ doc: () => ({ get: mockCostGet }) })
  }));
  return { firestore: firestoreFn };
});

import { getEmployeeCostHandler } from '../get-employee-cost';

const ADMIN_UID = 'admin-uid-test-fixture-001';
const EMAIL = 'employee-fixture@example.com';

function makeRequest(overrides: Record<string, unknown> = {}): Parameters<typeof getEmployeeCostHandler>[0] {
  const auth = overrides.auth === null
    ? null
    : { uid: ADMIN_UID, token: { role: 'admin' } };
  return {
    auth,
    data: { email: EMAIL },
    ...overrides
  } as unknown as Parameters<typeof getEmployeeCostHandler>[0];
}

beforeEach(() => {
  mockCostGet.mockReset().mockResolvedValue({
    exists: true,
    data: () => ({ costPerHour: 150, currency: 'ILS', source: 'accountant', validFrom: 'TS', validUntil: null })
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (a) Static AST invariants
// ════════════════════════════════════════════════════════════════════════════
/**
 * Strip line + block comments so AST-style regex guards inspect CODE ONLY.
 * A JSDoc line that documents the PII rule legitimately mentions `logger` and
 * `costPerHour`; without stripping, a naive regex would false-positive on the
 * documentation. Stripping makes the guard stricter (real calls only).
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

describe('getEmployeeCost — static AST invariants', () => {
  let source: string;
  let code: string;

  beforeAll(() => {
    source = fs.readFileSync(path.resolve(__dirname, '../get-employee-cost.ts'), 'utf8');
    code = stripComments(source);
  });

  it('is admin-gated (role-only, Pre-H.0.0.E follow-up) with NO self-read carve-out', () => {
    expect(code).toContain("const isAdmin = claims.role === 'admin'");
    expect(code).not.toContain('claims.admin === true'); // legacy boolean gate retired
    // There must be NO comparison of a target email against the caller's email
    // (which would be a self-read exception). Inspect code only.
    expect(code).not.toMatch(/===\s*request\.auth\.token\.email/);
    expect(source).not.toContain('self-read carve-out OK');
  });

  it('NEVER logs the cost value via logger.* (PII discipline)', () => {
    expect(code).not.toMatch(/logger\.\w+\([^)]*costPerHour/);
  });

  it('is read-only — no audit write, no logCriticalAction', () => {
    // Code-only: comments reference logCriticalAction/.set() to explain why
    // this read path deliberately omits them.
    expect(code).not.toContain('logCriticalAction');
    expect(code).not.toMatch(/\.set\(/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (b) Runtime
// ════════════════════════════════════════════════════════════════════════════
describe('getEmployeeCostHandler — auth gates', () => {
  it('rejects unauthenticated', async () => {
    await expect(getEmployeeCostHandler(makeRequest({ auth: null }))).rejects.toMatchObject({
      code: 'unauthenticated'
    });
  });

  it('rejects non-admin employee (NO self-read — even for own cost)', async () => {
    const req = makeRequest({ auth: { uid: 'e1', token: { role: 'employee' } } });
    await expect(getEmployeeCostHandler(req)).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('accepts admin via canonical role:admin', async () => {
    const res = await getEmployeeCostHandler(makeRequest());
    expect(res.success).toBe(true);
    expect(res.costPerHour).toBe(150);
  });

  it('REJECTS legacy admin:true-only token (Pre-H.0.0.E follow-up — role-only gate)', async () => {
    const req = makeRequest({ auth: { uid: ADMIN_UID, token: { admin: true } } });
    await expect(getEmployeeCostHandler(req)).rejects.toMatchObject({ code: 'permission-denied' });
  });
});

describe('getEmployeeCostHandler — validation + not-found', () => {
  it('rejects invalid email (Zod)', async () => {
    await expect(getEmployeeCostHandler(makeRequest({ data: { email: 'bad' } })))
      .rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects unknown extra field (.strict)', async () => {
    await expect(getEmployeeCostHandler(makeRequest({ data: { email: EMAIL, hack: 1 } })))
      .rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('returns not-found when no cost doc exists', async () => {
    mockCostGet.mockResolvedValueOnce({ exists: false, data: () => undefined });
    await expect(getEmployeeCostHandler(makeRequest())).rejects.toMatchObject({ code: 'not-found' });
  });

  it('returns the cost record on success', async () => {
    const res = await getEmployeeCostHandler(makeRequest());
    expect(res).toMatchObject({
      success: true,
      email: EMAIL,
      costPerHour: 150,
      currency: 'ILS',
      source: 'accountant'
    });
  });
});
