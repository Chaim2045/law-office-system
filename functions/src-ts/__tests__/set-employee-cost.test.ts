/**
 * setEmployeeCost — runtime + static guards (Pre-H.0.0.G)
 * ─────────────────────────────────────────────────────────────────────────────
 * Mirrors set-admin-claims.test.ts: (a) static AST guards on the source, (b)
 * runtime invocation of the exported handler with mocked firebase-admin +
 * mocked logCriticalAction.
 */
import * as fs from 'fs';
import * as path from 'path';

// ─── Mocks (declared before importing the handler) ──────────────────────────
const mockEmployeeGet = jest.fn();
const mockCostGet = jest.fn();
const mockCostSet = jest.fn();
const mockLogCriticalAction = jest.fn();

jest.mock('../audit-critical', () => ({
  logCriticalAction: (...args: unknown[]) => mockLogCriticalAction(...args)
}));

jest.mock('firebase-admin', () => {
  function collection(name: string): unknown {
    if (name === 'employees') {
      return { doc: () => ({ get: mockEmployeeGet }) };
    }
    if (name === 'employee_costs') {
      return { doc: () => ({ get: mockCostGet, set: mockCostSet }) };
    }
    return { doc: () => ({ get: jest.fn(), set: jest.fn() }) };
  }
  const firestoreFn: jest.Mock & { FieldValue?: unknown; Timestamp?: unknown } = jest.fn(() => ({
    collection
  }));
  firestoreFn.FieldValue = { serverTimestamp: jest.fn(() => 'SERVER_TS_SENTINEL') };
  firestoreFn.Timestamp = { fromDate: jest.fn((d: Date) => ({ __ts: d.toISOString() })) };
  return { firestore: firestoreFn };
});

import { setEmployeeCostHandler } from '../set-employee-cost';

// ─── Fixtures ───────────────────────────────────────────────────────────────
const ADMIN_UID = 'admin-uid-test-fixture-001';
const EMAIL = 'employee-fixture@example.com';
const AUDIT_ID = 'audit-doc-fixture';

function makeRequest(overrides: Record<string, unknown> = {}): Parameters<typeof setEmployeeCostHandler>[0] {
  const auth = overrides.auth === null
    ? null
    : { uid: ADMIN_UID, token: { role: 'admin' } };
  return {
    auth,
    data: { email: EMAIL, costPerHour: 150 },
    ...overrides
  } as unknown as Parameters<typeof setEmployeeCostHandler>[0];
}

beforeEach(() => {
  mockEmployeeGet.mockReset().mockResolvedValue({ exists: true });
  mockCostGet.mockReset().mockResolvedValue({ exists: false, data: () => undefined });
  mockCostSet.mockReset().mockResolvedValue(undefined);
  mockLogCriticalAction.mockReset().mockResolvedValue(AUDIT_ID);
});

// ════════════════════════════════════════════════════════════════════════════
// (a) Static AST invariants
// ════════════════════════════════════════════════════════════════════════════
/**
 * Strip line comments (//...) and block comments (/* ... *\/) from TS source so
 * AST-style regex guards inspect CODE ONLY, never documentation. Without this,
 * a JSDoc line that *mentions* `logger` and `costPerHour` (the very thing we
 * document as forbidden) would trip a naive `logger\.\w+\(...costPerHour` regex
 * — a false positive. Stripping comments makes the PII guard STRICTER (it can
 * only match real calls) while letting us keep explanatory comments.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1'); // line comments (avoid matching http://)
}

describe('setEmployeeCost — static AST invariants', () => {
  let source: string;
  let code: string;

  beforeAll(() => {
    source = fs.readFileSync(path.resolve(__dirname, '../set-employee-cost.ts'), 'utf8');
    code = stripComments(source);
  });

  it('imports the canonical logCriticalAction (no local audit clone)', () => {
    expect(source).toContain('logCriticalAction');
    expect(source).toMatch(/from\s+['"]\.\/audit-critical['"]/);
    expect(source).not.toContain('function writeAuditOrThrow');
  });

  it('audit-FIRST: logCriticalAction call precedes the costRef.set write', () => {
    const auditIdx = source.indexOf("logCriticalAction('SET_EMPLOYEE_COST'");
    const writeIdx = source.indexOf('costRef.set(');
    expect(auditIdx).toBeGreaterThan(0);
    expect(writeIdx).toBeGreaterThan(0);
    expect(auditIdx).toBeLessThan(writeIdx);
  });

  it('uses Zod .strict() input validation', () => {
    expect(source).toContain('setEmployeeCostInputSchema.safeParse');
  });

  it('NEVER logs the cost value via logger.* (PII discipline — Attack #3)', () => {
    // Inspect CODE ONLY (comments stripped) — documentation may legitimately
    // mention costPerHour/newCost when explaining the PII rule.
    expect(code).not.toMatch(/logger\.\w+\([^)]*costPerHour/);
    expect(code).not.toMatch(/logger\.\w+\([^)]*newCost/);
  });

  it('stamps updatedBy from caller UID, not email', () => {
    expect(source).toContain('updatedBy: callerUid');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (b) Runtime — auth gates
// ════════════════════════════════════════════════════════════════════════════
describe('setEmployeeCostHandler — auth gates', () => {
  it('rejects unauthenticated', async () => {
    await expect(setEmployeeCostHandler(makeRequest({ auth: null }))).rejects.toMatchObject({
      code: 'unauthenticated'
    });
    expect(mockCostSet).not.toHaveBeenCalled();
  });

  it('rejects non-admin (employee)', async () => {
    const req = makeRequest({ auth: { uid: 'e1', token: { role: 'employee' } } });
    await expect(setEmployeeCostHandler(req)).rejects.toMatchObject({ code: 'permission-denied' });
    expect(mockCostSet).not.toHaveBeenCalled();
  });

  it('accepts admin via canonical role:admin', async () => {
    const res = await setEmployeeCostHandler(makeRequest());
    expect(res.success).toBe(true);
    expect(mockCostSet).toHaveBeenCalledTimes(1);
  });

  it('REJECTS legacy admin:true-only token (Pre-H.0.0.E follow-up — role-only gate)', async () => {
    const req = makeRequest({ auth: { uid: ADMIN_UID, token: { admin: true } } });
    await expect(setEmployeeCostHandler(req)).rejects.toMatchObject({ code: 'permission-denied' });
    expect(mockCostSet).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Zod validation
// ════════════════════════════════════════════════════════════════════════════
describe('setEmployeeCostHandler — Zod validation', () => {
  it('rejects missing costPerHour', async () => {
    await expect(setEmployeeCostHandler(makeRequest({ data: { email: EMAIL } })))
      .rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects negative costPerHour', async () => {
    await expect(setEmployeeCostHandler(makeRequest({ data: { email: EMAIL, costPerHour: -5 } })))
      .rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects costPerHour above max (20000)', async () => {
    await expect(setEmployeeCostHandler(makeRequest({ data: { email: EMAIL, costPerHour: 25000 } })))
      .rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects invalid email', async () => {
    await expect(setEmployeeCostHandler(makeRequest({ data: { email: 'not-an-email', costPerHour: 150 } })))
      .rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects unknown extra field (.strict)', async () => {
    await expect(setEmployeeCostHandler(makeRequest({ data: { email: EMAIL, costPerHour: 150, hack: 1 } })))
      .rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects invalid source enum', async () => {
    await expect(setEmployeeCostHandler(makeRequest({ data: { email: EMAIL, costPerHour: 150, source: 'bogus' } })))
      .rejects.toMatchObject({ code: 'invalid-argument' });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Existence + fail-secure ordering
// ════════════════════════════════════════════════════════════════════════════
describe('setEmployeeCostHandler — existence + fail-secure', () => {
  it('rejects when employee does not exist (not-found), no audit, no write', async () => {
    mockEmployeeGet.mockResolvedValueOnce({ exists: false });
    await expect(setEmployeeCostHandler(makeRequest())).rejects.toMatchObject({ code: 'not-found' });
    expect(mockLogCriticalAction).not.toHaveBeenCalled();
    expect(mockCostSet).not.toHaveBeenCalled();
  });

  it('aborts WITHOUT writing cost when audit fails', async () => {
    mockLogCriticalAction.mockRejectedValueOnce(new Error('audit down'));
    await expect(setEmployeeCostHandler(makeRequest())).rejects.toMatchObject({ code: 'internal' });
    expect(mockCostSet).not.toHaveBeenCalled();
  });

  it('writes compensating audit when the cost write fails', async () => {
    mockCostSet.mockRejectedValueOnce(new Error('write down'));
    mockLogCriticalAction
      .mockResolvedValueOnce(AUDIT_ID) // primary
      .mockResolvedValueOnce('compensating-id'); // compensating
    await expect(setEmployeeCostHandler(makeRequest())).rejects.toMatchObject({ code: 'internal' });
    expect(mockLogCriticalAction).toHaveBeenCalledTimes(2);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Happy path
// ════════════════════════════════════════════════════════════════════════════
describe('setEmployeeCostHandler — happy path', () => {
  it('records previousCost in audit, writes the doc, returns the response', async () => {
    mockCostGet.mockResolvedValueOnce({ exists: true, data: () => ({ costPerHour: 120 }) });
    const res = await setEmployeeCostHandler(makeRequest({ data: { email: EMAIL, costPerHour: 150 } }));

    // audit recorded previous + new cost
    const auditArgs = mockLogCriticalAction.mock.calls[0];
    expect(auditArgs[0]).toBe('SET_EMPLOYEE_COST');
    expect(auditArgs[1]).toBe(ADMIN_UID);
    expect(auditArgs[2]).toMatchObject({ targetEmail: EMAIL, previousCost: 120, newCost: 150 });

    // doc written with the canonical shape
    const written = mockCostSet.mock.calls[0][0];
    expect(written).toMatchObject({
      email: EMAIL,
      costPerHour: 150,
      currency: 'ILS',
      validUntil: null,
      updatedBy: ADMIN_UID,
      source: 'manual',
      schemaVersion: 1
    });

    expect(res).toEqual({
      success: true,
      email: EMAIL,
      costPerHour: 150,
      currency: 'ILS',
      auditDocId: AUDIT_ID
    });
  });

  it('lowercases the email before existence-check + write (same key)', async () => {
    const res = await setEmployeeCostHandler(
      makeRequest({ data: { email: 'EMPLOYEE-Fixture@Example.com', costPerHour: 150 } })
    );
    expect(res.email).toBe(EMAIL); // normalized to lowercase
    expect(mockCostSet.mock.calls[0][0].email).toBe(EMAIL);
  });
});
