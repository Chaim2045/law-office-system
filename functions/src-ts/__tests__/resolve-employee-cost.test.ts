/**
 * resolveEmployeeCost + cost-stamping guard — Phase 2 H.2
 * ─────────────────────────────────────────────────────────────────────────────
 * (a) Unit: the resolver never throws, never 0-by-default, never logs the cost
 *     value; buildEntryCostDoc shape.
 * (b) Static AST guard: every timesheet-entry CREATE path resolves the cost AND
 *     writes the CF-only timesheet_entry_costs doc — so a future write path cannot
 *     silently create an un-costed entry (the devils-advocate atomicity 🔴).
 */
import * as fs from 'fs';
import * as path from 'path';

const mockGet = jest.fn();
jest.mock('firebase-admin', () => {
  const firestoreFn = () => ({ collection: () => ({ doc: () => ({ get: mockGet }) }) });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (firestoreFn as any).FieldValue = { serverTimestamp: () => 'ts-sentinel' };
  return { firestore: firestoreFn };
});

const loggerCalls: string[] = [];
jest.mock('../../shared/logger', () => ({
  info: (...a: unknown[]) => { loggerCalls.push(JSON.stringify(a)); },
  warn: (...a: unknown[]) => { loggerCalls.push(JSON.stringify(a)); },
  error: (...a: unknown[]) => { loggerCalls.push(JSON.stringify(a)); }
}));

import {
  resolveEmployeeCost,
  buildEntryCostDoc,
  TIMESHEET_ENTRY_COSTS_COLLECTION
} from '../employee-costs/resolve-employee-cost';

const COST_SENTINEL = 987654; // a recognizable cost value for the no-PII scan

beforeEach(() => {
  mockGet.mockReset();
  loggerCalls.length = 0;
});

describe('resolveEmployeeCost', () => {
  it('returns null/no_cost_doc for an empty/missing email (never throws)', async () => {
    await expect(resolveEmployeeCost('')).resolves.toEqual({ costPerHour: null, costSource: 'no_cost_doc' });
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('returns null/no_cost_doc when the cost doc does not exist', async () => {
    mockGet.mockResolvedValueOnce({ exists: false });
    await expect(resolveEmployeeCost('a@b.com')).resolves.toEqual({ costPerHour: null, costSource: 'no_cost_doc' });
  });

  it('returns the cost + employee_costs source for a valid positive cost', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ costPerHour: COST_SENTINEL }) });
    await expect(resolveEmployeeCost('A@B.com')).resolves.toEqual({ costPerHour: COST_SENTINEL, costSource: 'employee_costs' });
  });

  it('returns null (NEVER 0) when the doc exists but cost is 0/invalid/absent', async () => {
    for (const bad of [0, -5, NaN, 'x', undefined]) {
      mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ costPerHour: bad }) });
      const r = await resolveEmployeeCost('a@b.com');
      expect(r).toEqual({ costPerHour: null, costSource: 'no_cost_doc' });
    }
  });

  it('degrades to null/resolve_error on a read failure — never throws, logs errorCode ONLY', async () => {
    mockGet.mockRejectedValueOnce({ code: 'unavailable', message: `SECRET-${COST_SENTINEL}` });
    const r = await resolveEmployeeCost('a@b.com');
    expect(r).toEqual({ costPerHour: null, costSource: 'resolve_error' });
    const blob = loggerCalls.join(' ');
    expect(blob).toContain('unavailable');                 // errorCode logged
    expect(blob).not.toContain(String(COST_SENTINEL));     // no value / message leaked
  });
});

describe('buildEntryCostDoc', () => {
  it('builds the entry-keyed cost doc (lowercased employee, schemaVersion, stampedAt)', () => {
    const doc = buildEntryCostDoc('ENTRY1', 'A@B.com', { costPerHour: 100, costSource: 'employee_costs' });
    expect(doc).toEqual({
      entryId: 'ENTRY1',
      employee: 'a@b.com',
      costPerHour: 100,
      costSource: 'employee_costs',
      schemaVersion: 1,
      stampedAt: 'ts-sentinel'
    });
  });

  it('preserves a null cost + a backfill source', () => {
    const doc = buildEntryCostDoc('e2', 'x@y.com', { costPerHour: null, costSource: 'backfill_approx' });
    expect(doc.costPerHour).toBeNull();
    expect(doc.costSource).toBe('backfill_approx');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Static AST guard — every CREATE path stamps the cost (no silent skip)
// ════════════════════════════════════════════════════════════════════════════
describe('cost-stamping guard — all 3 entry-create paths stamp a cost doc', () => {
  const TIMESHEET = path.resolve(__dirname, '../../timesheet/index.js');
  const ADD_TIME = path.resolve(__dirname, '../../addTimeToTask_v2.js');

  it.each([
    ['timesheet/index.js', TIMESHEET],
    ['addTimeToTask_v2.js', ADD_TIME]
  ])('%s resolves the cost AND writes the timesheet_entry_costs doc', (_name, file) => {
    const src = fs.readFileSync(file, 'utf8');
    expect(src).toMatch(/resolveEmployeeCost\(user\.email\)/);
    expect(src).toContain('TIMESHEET_ENTRY_COSTS_COLLECTION');
    expect(src).toContain('buildEntryCostDoc(');
    // the cost write must target the new collection const, not the entry doc
    expect(src).toMatch(/collection\(TIMESHEET_ENTRY_COSTS_COLLECTION\)\.doc\(/);
  });

  it('the collection name is the locked CF-only const', () => {
    expect(TIMESHEET_ENTRY_COSTS_COLLECTION).toBe('timesheet_entry_costs');
  });

  it('timesheet/index.js stamps in BOTH create paths (quick-log + v2)', () => {
    const src = fs.readFileSync(TIMESHEET, 'utf8');
    // two distinct create paths → two resolve calls + two cost-doc writes
    expect((src.match(/resolveEmployeeCost\(user\.email\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((src.match(/collection\(TIMESHEET_ENTRY_COSTS_COLLECTION\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
