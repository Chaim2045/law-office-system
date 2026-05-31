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
describe('getEmployeeCost — static AST invariants', () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(path.resolve(__dirname, '../get-employee-cost.ts'), 'utf8');
  });

  it('is admin-gated with NO self-read carve-out', () => {
    expect(source).toContain("claims.role === 'admin' || claims.admin === true");
    // There must be NO comparison of a target email against the caller's email
    // (which would be a self-read exception). Guard against it.
    expect(source).not.toMatch(/===\s*request\.auth\.token\.email/);
    expect(source).not.toContain('self-read carve-out OK');
  });

  it('NEVER logs the cost value via logger.* (PII discipline)', () => {
    expect(source).not.toMatch(/logger\.\w+\([^)]*costPerHour/);
  });

  it('is read-only — no audit write, no logCriticalAction', () => {
    expect(source).not.toContain('logCriticalAction');
    expect(source).not.toContain('.set(');
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

  it('accepts admin via legacy admin:true (dual-shape gate)', async () => {
    const req = makeRequest({ auth: { uid: ADMIN_UID, token: { admin: true } } });
    const res = await getEmployeeCostHandler(req);
    expect(res.success).toBe(true);
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
