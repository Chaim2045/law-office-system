/**
 * listUnlinkedSalesRecords — H.6.c-2 union test
 * ─────────────────────────────────────────────────────────────────────────────
 * The load-bearing H.6.c-2 change: a sale is "linked" (i.e. removed from the
 * create-eligible "unlinked" queue) if it has EITHER a permanent
 * `sales_record_links` doc OR a `pending_signature_intents` marker (a pending
 * client already exists / is mid-creation for it). Without the union, a
 * pending-signature sale would re-appear as unlinked → an admin could create a
 * SECOND pending client for the same sale.
 *
 * Also (a) a static AST guard that both id-only reads are present, and (b) a
 * runtime no-PII-in-logs scan.
 *
 * NO real cross-project call — the named app, both firestores, and the audit
 * write are fully mocked.
 */
import * as fs from 'fs';
import * as path from 'path';

// ─── Mocks (declared before importing the handler) ──────────────────────────
const mockSalesGet = jest.fn();     // tofes-mecher: .collection(sales).get()
const mockLinksGet = jest.fn();     // MAIN: .collection(sales_record_links).select().get()
const mockIntentsGet = jest.fn();   // MAIN: .collection(pending_signature_intents).select().get()
const mockAuditAdd = jest.fn();     // audit_log .add(doc)
const mockAppLookup = jest.fn();
const mockInitializeApp = jest.fn();
const mockCert = jest.fn();

jest.mock('firebase-admin', () => {
  // The tofes-mecher named app: .collection(TOFES_SALES).get()
  const namedFirestore = () => ({
    collection: () => ({ get: mockSalesGet })
  });
  // The default (MAIN) app: routes by collection name.
  const defaultFirestore = () => ({
    collection: (name: string) => {
      if (name === 'sales_record_links') {
        return { select: () => ({ get: mockLinksGet }) };
      }
      if (name === 'pending_signature_intents') {
        return { select: () => ({ get: mockIntentsGet }) };
      }
      // audit_log (via logCriticalAction)
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

jest.mock('firebase-functions/params', () => ({
  defineSecret: (name: string) => ({ name, value: () => '{"fake":"sa-key"}' })
}));

const loggerCalls: string[] = [];
jest.mock('../../shared/logger', () => ({
  info: (...a: unknown[]) => { loggerCalls.push(JSON.stringify(a)); },
  warn: (...a: unknown[]) => { loggerCalls.push(JSON.stringify(a)); },
  error: (...a: unknown[]) => { loggerCalls.push(JSON.stringify(a)); }
}));

import { listUnlinkedSalesRecordsHandler } from '../tofes-mecher/list-unlinked-sales-records';
import { __resetTofesMecherAppForTests } from '../tofes-mecher/app';

const ADMIN_UID = 'admin-uid-test-fixture-001';

// Sentinel PII values — the runtime scan asserts NONE reach logger.*.
const PII = {
  idNumber: 'IDNUM-SENTINEL-123456789',
  clientName: 'CLIENTNAME-SENTINEL',
  phone: 'PHONE-SENTINEL',
  email: 'EMAIL-SENTINEL',
  address: 'ADDRESS-SENTINEL'
};

/** A tofes sales_records doc snapshot. */
function saleDoc(id: string) {
  return {
    id,
    data: () => ({
      ...PII,
      amountBeforeVat: 1000,
      vatAmount: 170,
      amountWithVat: 1170,
      amount: 1170,
      transactionType: 'ייעוץ',
      timestamp: { toDate: () => new Date('2026-01-02T03:04:05.000Z') }
    })
  };
}

/** An id-only doc snapshot (for the .select() reads). */
function idDoc(id: string) {
  return { id };
}

function makeRequest(overrides: Record<string, unknown> = {}): Parameters<typeof listUnlinkedSalesRecordsHandler>[0] {
  const auth = 'auth' in overrides ? overrides.auth : { uid: ADMIN_UID, token: { role: 'admin' } };
  return { auth, data: {} } as unknown as Parameters<typeof listUnlinkedSalesRecordsHandler>[0];
}

beforeEach(() => {
  __resetTofesMecherAppForTests();
  mockAppLookup.mockReset().mockImplementation(() => { throw new Error('app/no-app'); });
  mockInitializeApp.mockReset();
  mockCert.mockReset().mockReturnValue({ __cred: true });
  mockAuditAdd.mockReset().mockResolvedValue({ id: 'audit-doc-id' });
  mockSalesGet.mockReset();
  mockLinksGet.mockReset();
  mockIntentsGet.mockReset();
  loggerCalls.length = 0;
});

// ════════════════════════════════════════════════════════════════════════════
// (a) Static AST invariant — both id-only reads are present (the union)
// ════════════════════════════════════════════════════════════════════════════
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

describe('list-unlinked-sales-records — static AST invariants (H.6.c-2 union)', () => {
  let code: string;
  beforeAll(() => {
    code = stripComments(fs.readFileSync(
      path.resolve(__dirname, '../tofes-mecher/list-unlinked-sales-records.ts'), 'utf8'
    ));
  });

  it('reads BOTH sales_record_links AND pending_signature_intents (id-only .select())', () => {
    expect(code).toContain("'sales_record_links'");
    expect(code).toContain("'pending_signature_intents'");
    // both reads are id-only projections
    expect((code.match(/\.select\(\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (b) Runtime — the union removes both linked + pending sales from "unlinked"
// ════════════════════════════════════════════════════════════════════════════
describe('listUnlinkedSalesRecords — union of links + pending intents', () => {
  it('a sale with a pending_signature_intents marker (no link) is NOT unlinked', async () => {
    // sales: s_linked, s_pending, s_free
    mockSalesGet.mockResolvedValue({
      docs: [saleDoc('s_linked'), saleDoc('s_pending'), saleDoc('s_free')]
    });
    mockLinksGet.mockResolvedValue({ docs: [idDoc('s_linked')] });
    mockIntentsGet.mockResolvedValue({ docs: [idDoc('s_pending')] });

    const res = await listUnlinkedSalesRecordsHandler(makeRequest());

    expect(res.totalSales).toBe(3);
    // linkedCount = union of {s_linked} ∪ {s_pending} = 2
    expect(res.linkedCount).toBe(2);
    expect(res.unlinkedCount).toBe(1);
    const ids = res.unlinkedRecords.map(r => r.salesRecordId);
    expect(ids).toEqual(['s_free']);
    expect(ids).not.toContain('s_pending'); // ← the H.6.c-2 guarantee
    expect(ids).not.toContain('s_linked');
  });

  it('a sale in BOTH collections is counted once (Set union, no double count)', async () => {
    mockSalesGet.mockResolvedValue({ docs: [saleDoc('s_both'), saleDoc('s_free')] });
    mockLinksGet.mockResolvedValue({ docs: [idDoc('s_both')] });
    mockIntentsGet.mockResolvedValue({ docs: [idDoc('s_both')] });

    const res = await listUnlinkedSalesRecordsHandler(makeRequest());

    expect(res.linkedCount).toBe(1); // Set dedups s_both
    expect(res.unlinkedCount).toBe(1);
    expect(res.unlinkedRecords.map(r => r.salesRecordId)).toEqual(['s_free']);
  });

  it('no links + no pending intents → all sales are unlinked', async () => {
    mockSalesGet.mockResolvedValue({ docs: [saleDoc('a'), saleDoc('b')] });
    mockLinksGet.mockResolvedValue({ docs: [] });
    mockIntentsGet.mockResolvedValue({ docs: [] });

    const res = await listUnlinkedSalesRecordsHandler(makeRequest());

    expect(res.linkedCount).toBe(0);
    expect(res.unlinkedCount).toBe(2);
  });

  it('rejects a non-admin caller (permission-denied) before any read', async () => {
    await expect(
      listUnlinkedSalesRecordsHandler(makeRequest({ auth: { uid: 'x', token: { role: 'employee' } } }))
    ).rejects.toMatchObject({ code: 'permission-denied' });
    expect(mockSalesGet).not.toHaveBeenCalled();
  });

  it('never leaks PII into logger.* (union path)', async () => {
    mockSalesGet.mockResolvedValue({ docs: [saleDoc('s_free')] });
    mockLinksGet.mockResolvedValue({ docs: [] });
    mockIntentsGet.mockResolvedValue({ docs: [] });

    await listUnlinkedSalesRecordsHandler(makeRequest());

    const blob = loggerCalls.join('|');
    for (const v of Object.values(PII)) {
      expect(blob).not.toContain(v);
    }
  });
});
