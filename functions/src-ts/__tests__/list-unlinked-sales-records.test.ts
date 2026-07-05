/**
 * listUnlinkedSalesRecords — H.6.c-2-backend tests
 * ─────────────────────────────────────────────────────────────────────────────
 * The load-bearing invariant under test: a sale that ALREADY has a
 * `pending_signature_intents/{salesRecordId}` marker (c-1's two-phase intake)
 * must be excluded from the "unlinked" result, exactly like a sale that already
 * has a `sales_record_links/{salesRecordId}` doc — even though the two
 * collections are different and are populated by different writers.
 *
 * Mirrors the mocking style of `validate-sales-record.test.ts` (same directory,
 * same tofes-mecher/admin dual-firestore mock shape).
 *
 * NO real cross-project call — the named app, both firestores, and the audit
 * write are fully mocked.
 */

// ─── Mocks (declared before importing the handler) ──────────────────────────
const mockSalesGet = jest.fn();      // tofes-mecher sales_records collection .get()
const mockLinksGet = jest.fn();      // main-project sales_record_links .get()
const mockPendingGet = jest.fn();    // main-project pending_signature_intents .get()
const mockAuditAdd = jest.fn();      // the audit_log .add(doc) write
const mockInitializeApp = jest.fn();
const mockAppLookup = jest.fn();
const mockCert = jest.fn();

jest.mock('firebase-admin', () => {
  // Named-app firestore (the tofes-mecher cross-project read path).
  const namedFirestore = () => ({
    collection: () => ({ get: mockSalesGet })
  });
  // Default-app firestore (main project): sales_record_links, pending_signature_intents,
  // and audit_log all live here. Route by collection name.
  const defaultFirestore = () => ({
    collection: (name: string) => {
      if (name === 'sales_record_links') {
        return { select: () => ({ get: mockLinksGet }) };
      }
      if (name === 'pending_signature_intents') {
        return { select: () => ({ get: mockPendingGet }) };
      }
      // audit_log (via logCriticalAction) — also used for .doc() no-ops elsewhere.
      return { add: mockAuditAdd, doc: () => ({}) };
    }
  });
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
  defineSecret: (name: string) => ({ name, value: () => '{"fake":"sa-key"}' })
}));

jest.mock('../../shared/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

import {
  listUnlinkedSalesRecordsHandler
} from '../tofes-mecher/list-unlinked-sales-records';
import { __resetTofesMecherAppForTests } from '../tofes-mecher/app';

const ADMIN_UID = 'admin-uid-test-fixture-002';

function makeRequest(overrides: Record<string, unknown> = {}): Parameters<typeof listUnlinkedSalesRecordsHandler>[0] {
  const auth = 'auth' in overrides ? overrides.auth : { uid: ADMIN_UID, token: { role: 'admin' } };
  const data = 'data' in overrides ? overrides.data : {};
  return { auth, data } as unknown as Parameters<typeof listUnlinkedSalesRecordsHandler>[0];
}

/** A minimal tofes sales_records doc snapshot (id + a data() shape). */
function salesDoc(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    data: () => ({
      clientName: `Client-${id}`,
      idNumber: '000000018',
      amountBeforeVat: 1000,
      vatAmount: 170,
      amountWithVat: 1170,
      amount: 1170,
      transactionType: 'ייעוץ',
      timestamp: { toDate: () => new Date('2026-01-02T03:04:05.000Z') },
      ...extra
    })
  };
}

/** An id-only doc snapshot (as returned by `.select().get()`). */
function idDoc(id: string) {
  return { id };
}

beforeEach(() => {
  __resetTofesMecherAppForTests();
  mockSalesGet.mockReset().mockResolvedValue({ docs: [] });
  mockLinksGet.mockReset().mockResolvedValue({ docs: [] });
  mockPendingGet.mockReset().mockResolvedValue({ docs: [] });
  mockAuditAdd.mockReset().mockResolvedValue({ id: 'audit-doc-id' });
  mockInitializeApp.mockReset();
  mockAppLookup.mockReset().mockImplementation(() => { throw new Error('app/no-app'); });
  mockCert.mockReset().mockReturnValue({ __cred: true });
});

describe('listUnlinkedSalesRecords — auth gate', () => {
  it('rejects unauthenticated', async () => {
    await expect(listUnlinkedSalesRecordsHandler(makeRequest({ auth: null })))
      .rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('rejects non-admin', async () => {
    const req = makeRequest({ auth: { uid: 'e1', token: { role: 'employee' } } });
    await expect(listUnlinkedSalesRecordsHandler(req)).rejects.toMatchObject({ code: 'permission-denied' });
  });
});

describe('listUnlinkedSalesRecords — the pending_signature_intents union (H.6.c-2)', () => {
  it('a sale with a pending_signature_intents doc is EXCLUDED from unlinked, even with no sales_record_links doc', async () => {
    mockSalesGet.mockResolvedValueOnce({ docs: [salesDoc('SALE-PENDING-1')] });
    mockLinksGet.mockResolvedValueOnce({ docs: [] });
    mockPendingGet.mockResolvedValueOnce({ docs: [idDoc('SALE-PENDING-1')] });

    const res = await listUnlinkedSalesRecordsHandler(makeRequest());

    expect(res.unlinkedRecords.map((r) => r.salesRecordId)).not.toContain('SALE-PENDING-1');
    expect(res.unlinkedCount).toBe(0);
    expect(res.pendingCount).toBe(1);
    expect(res.linkedCount).toBe(0);
    expect(res.totalSales).toBe(1);
  });

  it('a sale with a sales_record_links doc is still excluded (unchanged prior behavior)', async () => {
    mockSalesGet.mockResolvedValueOnce({ docs: [salesDoc('SALE-LINKED-1')] });
    mockLinksGet.mockResolvedValueOnce({ docs: [idDoc('SALE-LINKED-1')] });
    mockPendingGet.mockResolvedValueOnce({ docs: [] });

    const res = await listUnlinkedSalesRecordsHandler(makeRequest());

    expect(res.unlinkedRecords.map((r) => r.salesRecordId)).not.toContain('SALE-LINKED-1');
    expect(res.unlinkedCount).toBe(0);
    expect(res.linkedCount).toBe(1);
    expect(res.pendingCount).toBe(0);
  });

  it('a sale in NEITHER collection is still returned as unlinked', async () => {
    mockSalesGet.mockResolvedValueOnce({ docs: [salesDoc('SALE-FREE-1')] });
    mockLinksGet.mockResolvedValueOnce({ docs: [] });
    mockPendingGet.mockResolvedValueOnce({ docs: [] });

    const res = await listUnlinkedSalesRecordsHandler(makeRequest());

    expect(res.unlinkedRecords.map((r) => r.salesRecordId)).toEqual(['SALE-FREE-1']);
    expect(res.unlinkedCount).toBe(1);
    expect(res.linkedCount).toBe(0);
    expect(res.pendingCount).toBe(0);
  });

  it('mixed set: linked, pending, and free sales are each classified correctly and counts stay distinct (not conflated)', async () => {
    mockSalesGet.mockResolvedValueOnce({
      docs: [
        salesDoc('SALE-LINKED-2'),
        salesDoc('SALE-PENDING-2'),
        salesDoc('SALE-FREE-2'),
        salesDoc('SALE-FREE-3')
      ]
    });
    mockLinksGet.mockResolvedValueOnce({ docs: [idDoc('SALE-LINKED-2')] });
    mockPendingGet.mockResolvedValueOnce({ docs: [idDoc('SALE-PENDING-2')] });

    const res = await listUnlinkedSalesRecordsHandler(makeRequest());

    expect(res.totalSales).toBe(4);
    expect(res.linkedCount).toBe(1);
    expect(res.pendingCount).toBe(1);
    expect(res.unlinkedCount).toBe(2);
    expect(res.unlinkedRecords.map((r) => r.salesRecordId).sort()).toEqual(
      ['SALE-FREE-2', 'SALE-FREE-3'].sort()
    );
  });

  it('a sale present in BOTH links and pending (defensive edge case) is excluded once, counted in both counters', async () => {
    mockSalesGet.mockResolvedValueOnce({ docs: [salesDoc('SALE-BOTH-1')] });
    mockLinksGet.mockResolvedValueOnce({ docs: [idDoc('SALE-BOTH-1')] });
    mockPendingGet.mockResolvedValueOnce({ docs: [idDoc('SALE-BOTH-1')] });

    const res = await listUnlinkedSalesRecordsHandler(makeRequest());

    expect(res.unlinkedCount).toBe(0);
    expect(res.linkedCount).toBe(1);
    expect(res.pendingCount).toBe(1);
  });
});

describe('listUnlinkedSalesRecords — audit + log payload includes pendingCount distinctly', () => {
  it('the non-PII audit payload carries linkedCount and pendingCount as separate fields', async () => {
    mockSalesGet.mockResolvedValueOnce({ docs: [salesDoc('SALE-AUDIT-1')] });
    mockLinksGet.mockResolvedValueOnce({ docs: [] });
    mockPendingGet.mockResolvedValueOnce({ docs: [idDoc('SALE-AUDIT-1')] });

    await listUnlinkedSalesRecordsHandler(makeRequest());

    expect(mockAuditAdd).toHaveBeenCalledTimes(1);
    const doc = mockAuditAdd.mock.calls[0][0];
    expect(doc.action).toBe('LIST_UNLINKED_SALES_RECORDS');
    expect(doc.details).toMatchObject({
      totalSales: 1,
      linkedCount: 0,
      pendingCount: 1,
      unlinkedCount: 0
    });
  });
});

describe('listUnlinkedSalesRecords — failure paths', () => {
  it('throws Hebrew unavailable when the pending_signature_intents read fails (does not silently ignore it)', async () => {
    mockSalesGet.mockResolvedValueOnce({ docs: [salesDoc('SALE-X')] });
    mockLinksGet.mockResolvedValueOnce({ docs: [] });
    mockPendingGet.mockRejectedValueOnce({ code: 'permission-denied' });

    await expect(listUnlinkedSalesRecordsHandler(makeRequest()))
      .rejects.toMatchObject({ code: 'unavailable' });
    expect(mockAuditAdd).not.toHaveBeenCalled();
  });

  it('throws Hebrew unavailable when the sales_record_links read fails', async () => {
    mockSalesGet.mockResolvedValueOnce({ docs: [salesDoc('SALE-X')] });
    mockLinksGet.mockRejectedValueOnce({ code: 'permission-denied' });

    await expect(listUnlinkedSalesRecordsHandler(makeRequest()))
      .rejects.toMatchObject({ code: 'unavailable' });
    expect(mockPendingGet).not.toHaveBeenCalled();
    expect(mockAuditAdd).not.toHaveBeenCalled();
  });
});
