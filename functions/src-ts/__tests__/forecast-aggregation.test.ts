/**
 * forecast-aggregation — Phase 2 H.3 PR3 tests (the PURE compute heart)
 * ─────────────────────────────────────────────────────────────────────────────
 * computeForecastForClient is the load-bearing logic: join-by-entryId, null≠0,
 * un-costed coverage %, and archived-service parity with the Plan layer. These
 * are unit tests of the pure function (no Firestore) — the exact invariants the
 * profitability layer exists to protect.
 *
 * Also covers H.6.c-2 (handler-level): `aggregateClientProfitabilityHandler`
 * must skip a `pending_signature` CLIENT wholesale (no entries/costs read, no
 * `client_profitability` doc written), while a normal `active` client is still
 * aggregated as before.
 */

// ─── Mocks (so importing the module's top-level onSchedule wrapper is hermetic) ─
jest.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: (_config: unknown, handler: unknown) => handler
}));

// Mutable per-test fixtures for the handler-level (mocked-Firestore) tests.
let clientDocsFixture: Array<{ id: string; data: () => Record<string, unknown> }> = [];
const mockClientsGet = jest.fn();
const mockEntriesGet = jest.fn();
const mockGetAll = jest.fn();
const mockForecastSet = jest.fn();
const mockAuditAdd = jest.fn();

jest.mock('firebase-admin', () => {
  const firestoreFn = (() => ({
    collection: (name: string) => {
      if (name === 'clients') {
        return { get: mockClientsGet };
      }
      if (name === 'timesheet_entries') {
        return { where: () => ({ get: mockEntriesGet }) };
      }
      if (name === 'timesheet_entry_costs') {
        return { doc: (id: string) => ({ id }) };
      }
      if (name === 'client_profitability') {
        return { doc: () => ({ set: mockForecastSet }) };
      }
      // audit_log (via logCriticalAction) fallback.
      return { add: mockAuditAdd, doc: () => ({}) };
    },
    getAll: mockGetAll
  })) as unknown as Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (firestoreFn as any).FieldValue = { serverTimestamp: () => 'ts-sentinel' };
  return { firestore: firestoreFn };
});

jest.mock('../../shared/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

import {
  aggregateClientProfitabilityHandler,
  computeForecastForClient,
  exceedsFailureThreshold,
  FORECAST_MAX_FAILURE_RATE,
  FORECAST_SCHEMA_VERSION,
  _FORECAST_SKIP_STATUSES,
  type ForecastEntry
} from '../profitability/forecast-aggregation';

function clientDoc(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

const CASE = '2025724';

function entry(id: string, minutes: unknown, serviceId?: string, parentServiceId?: string): ForecastEntry {
  return { id, minutes, serviceId, parentServiceId };
}

beforeEach(() => {
  clientDocsFixture = [];
  mockClientsGet.mockReset().mockImplementation(() => Promise.resolve({ docs: clientDocsFixture }));
  mockEntriesGet.mockReset().mockResolvedValue({ docs: [] });
  mockGetAll.mockReset().mockResolvedValue([]);
  mockForecastSet.mockReset().mockResolvedValue(undefined);
  mockAuditAdd.mockReset().mockResolvedValue({ id: 'audit-doc-id' });
});

describe('computeForecastForClient — join by entryId, null≠0, coverage, archived parity', () => {
  it('all entries costed → actualCost = Σ(min/60 × cost), coverage 0%, costed=total', () => {
    const entries = [entry('e1', 60, 's1'), entry('e2', 30, 's1')];
    const costs = new Map<string, number | null>([
      ['e1', 100],
      ['e2', 200]
    ]);
    const f = computeForecastForClient(CASE, [{ id: 's1', status: 'active' }], entries, costs);
    expect(f.actualHours).toBe(1.5); // (60+30)/60
    expect(f.actualCost).toBe(200); // 1*100 + 0.5*200
    expect(f.costedEntryCount).toBe(2);
    expect(f.totalEntryCount).toBe(2);
    expect(f.unCostedCoveragePercent).toBe(0);
    expect(f.schemaVersion).toBe(FORECAST_SCHEMA_VERSION);
    expect(f.caseNumber).toBe(CASE);
  });

  it('NO entry costed (today: employee_costs=0) → actualCost is NULL (never 0), coverage 100%', () => {
    const entries = [entry('e1', 60, 's1'), entry('e2', 120, 's1')];
    const costs = new Map<string, number | null>(); // no cost docs at all
    const f = computeForecastForClient(CASE, [{ id: 's1', status: 'active' }], entries, costs);
    expect(f.actualHours).toBe(3); // hours still accrue
    expect(f.actualCost).toBeNull(); // ← the load-bearing null-≠-0 contract
    expect(f.costedEntryCount).toBe(0);
    expect(f.totalEntryCount).toBe(2);
    expect(f.unCostedCoveragePercent).toBe(100);
  });

  it('mixed coverage → costs only the costed entries; coverage = % un-costed over ALL live entries', () => {
    const entries = [entry('e1', 60, 's1'), entry('e2', 60, 's1'), entry('e3', 60, 's1')];
    const costs = new Map<string, number | null>([
      ['e1', 300],
      ['e3', null] // doc exists but cost unknown → un-costed (NOT 0)
      // e2 absent → also un-costed
    ]);
    const f = computeForecastForClient(CASE, [{ id: 's1', status: 'active' }], entries, costs);
    expect(f.actualCost).toBe(300); // ONLY e1 (e2 missing, e3 null) — never +0 for the others
    expect(f.costedEntryCount).toBe(1);
    expect(f.totalEntryCount).toBe(3);
    expect(f.unCostedCoveragePercent).toBe(66.67); // round2(100 * 2/3)
  });

  it('JOIN is strictly by entryId — a cost keyed to a different id does NOT attach', () => {
    const entries = [entry('e1', 60, 's1')];
    const costs = new Map<string, number | null>([['WRONG-EMPLOYEE-KEY', 999]]);
    const f = computeForecastForClient(CASE, [{ id: 's1', status: 'active' }], entries, costs);
    expect(f.actualCost).toBeNull(); // e1 has no cost under its own id → un-costed
    expect(f.costedEntryCount).toBe(0);
    expect(f.totalEntryCount).toBe(1);
  });

  it('a real cost of 0 (free/intern) is KNOWN — counts as costed (coverage covered), adds 0', () => {
    const entries = [entry('e1', 60, 's1'), entry('e2', 60, 's1')];
    const costs = new Map<string, number | null>([
      ['e1', 0], // known-free, NOT unknown
      ['e2', 100]
    ]);
    const f = computeForecastForClient(CASE, [{ id: 's1', status: 'active' }], entries, costs);
    expect(f.actualCost).toBe(100); // 0 + 100
    expect(f.costedEntryCount).toBe(2); // 0 is a known cost, distinct from null
    expect(f.unCostedCoveragePercent).toBe(0);
  });

  it('archived-service entries are EXCLUDED (Plan parity) — by serviceId AND parentServiceId', () => {
    const services = [
      { id: 's1', status: 'active' },
      { id: 's2', status: 'archived' }
    ];
    const entries = [
      entry('e1', 60, 's1'), // active service
      entry('e2', 120, 's2'), // archived service → excluded
      entry('e3', 30, undefined, 's2') // stage entry whose parent is archived → excluded
    ];
    const costs = new Map<string, number | null>([
      ['e1', 100],
      ['e2', 100],
      ['e3', 100]
    ]);
    const f = computeForecastForClient(CASE, services, entries, costs);
    expect(f.totalEntryCount).toBe(1); // only e1 is in scope
    expect(f.actualHours).toBe(1); // 60/60
    expect(f.actualCost).toBe(100); // only e1
    expect(f.costedEntryCount).toBe(1);
  });

  it('zero entries → actualHours 0, actualCost null, coverage null, counts 0', () => {
    const f = computeForecastForClient(CASE, [{ id: 's1', status: 'active' }], [], new Map());
    expect(f.actualHours).toBe(0);
    expect(f.actualCost).toBeNull();
    expect(f.costedEntryCount).toBe(0);
    expect(f.totalEntryCount).toBe(0);
    expect(f.unCostedCoveragePercent).toBeNull(); // null sentinel = "no work logged"
  });

  it('non-numeric minutes degrade to 0 hours (never NaN) but the entry still counts', () => {
    const entries = [entry('e1', undefined, 's1'), entry('e2', 60, 's1')];
    const costs = new Map<string, number | null>([['e2', 120]]);
    const f = computeForecastForClient(CASE, [{ id: 's1', status: 'active' }], entries, costs);
    expect(f.actualHours).toBe(1); // e1 contributes 0, e2 = 1h
    expect(Number.isNaN(f.actualHours)).toBe(false);
    expect(f.totalEntryCount).toBe(2);
    expect(f.costedEntryCount).toBe(1);
  });
});

describe('archived-filter drift guard', () => {
  it('_FORECAST_SKIP_STATUSES mirrors aggregates.NON_AGGREGATING_STATUSES (SSOT)', () => {
    const aggregates = require('../../shared/aggregates');
    expect([..._FORECAST_SKIP_STATUSES]).toEqual([...aggregates.NON_AGGREGATING_STATUSES]);
    expect([..._FORECAST_SKIP_STATUSES]).toEqual(['archived']);
  });
});

describe('exceedsFailureThreshold — systemic-failure alerting (not just 0-written)', () => {
  it('empty system (0 scanned) → false (no alert)', () => {
    expect(exceedsFailureThreshold(0, 0)).toBe(false);
  });

  it('all clients succeed → false', () => {
    expect(exceedsFailureThreshold(142, 0)).toBe(false);
  });

  it('a single malformed client among many → false (tolerated, logged)', () => {
    expect(exceedsFailureThreshold(142, 1)).toBe(false);
  });

  it('below the threshold (5% < 10%) → false', () => {
    expect(exceedsFailureThreshold(100, 5)).toBe(false);
  });

  it('AT the threshold (10%) → true (alerts)', () => {
    expect(exceedsFailureThreshold(100, 10)).toBe(true);
  });

  it('majority failure (the 99%-failed-but-2-written trap) → true', () => {
    expect(exceedsFailureThreshold(142, 140)).toBe(true);
  });

  it('total failure → true (subsumes the old 0-written case)', () => {
    expect(exceedsFailureThreshold(50, 50)).toBe(true);
  });

  it('the threshold constant is a sane share (0 < rate <= 1)', () => {
    expect(FORECAST_MAX_FAILURE_RATE).toBeGreaterThan(0);
    expect(FORECAST_MAX_FAILURE_RATE).toBeLessThanOrEqual(1);
  });
});

describe('aggregateClientProfitabilityHandler — pending_signature client skip (H.6.c-2)', () => {
  it('a pending_signature client is skipped wholesale — no entries/costs read, no client_profitability doc written', async () => {
    clientDocsFixture = [
      clientDoc('2025999', { status: 'pending_signature', services: [] })
    ];

    const result = await aggregateClientProfitabilityHandler();

    expect(result.clientsScanned).toBe(1);
    expect(result.clientsSkippedPending).toBe(1);
    expect(result.clientsWritten).toBe(0);
    expect(result.clientsFailed).toBe(0);
    expect(result.ok).toBe(true);
    // no per-client entries read and no Forecast doc written for the pending client
    expect(mockEntriesGet).not.toHaveBeenCalled();
    expect(mockForecastSet).not.toHaveBeenCalled();
  });

  it('a normal active client is still aggregated and written as before', async () => {
    clientDocsFixture = [
      clientDoc('2025724', { status: 'active', services: [{ id: 's1', status: 'active' }] })
    ];
    mockEntriesGet.mockResolvedValueOnce({ docs: [] });

    const result = await aggregateClientProfitabilityHandler();

    expect(result.clientsScanned).toBe(1);
    expect(result.clientsSkippedPending).toBe(0);
    expect(result.clientsWritten).toBe(1);
    expect(result.clientsFailed).toBe(0);
    expect(mockForecastSet).toHaveBeenCalledTimes(1);
    const written = mockForecastSet.mock.calls[0][0];
    expect(written.status).toBe('active');
    expect(written.caseNumber).toBe('2025724');
  });

  it('a mixed run: pending clients are skipped, active clients are written, counts stay distinct', async () => {
    clientDocsFixture = [
      clientDoc('2025001', { status: 'pending_signature', services: [] }),
      clientDoc('2025002', { status: 'active', services: [] }),
      clientDoc('2025003', { status: 'pending_signature', services: [] })
    ];
    mockEntriesGet.mockResolvedValue({ docs: [] });

    const result = await aggregateClientProfitabilityHandler();

    expect(result.clientsScanned).toBe(3);
    expect(result.clientsSkippedPending).toBe(2);
    expect(result.clientsWritten).toBe(1);
    expect(result.clientsFailed).toBe(0);
    expect(mockForecastSet).toHaveBeenCalledTimes(1);
  });
});
