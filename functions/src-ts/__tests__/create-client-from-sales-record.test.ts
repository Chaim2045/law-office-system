/**
 * createClientFromSalesRecord — Phase 2 H.6 tests
 * ─────────────────────────────────────────────────────────────────────────────
 * Mocks every external boundary (the SSOT tofes read, firebase-admin firestore +
 * transaction, the secret, the audit primitive, the logger) so NO real cross-project
 * call or Firestore write occurs (Engineering Bar §2.3 "mock the SDK boundary, not the
 * logic"). `computeClientPlan` runs FOR REAL (it is pure) so the "plan stamped"
 * assertion proves the actual derivation, not a stub.
 *
 * Covers (the locked H.6.a contract):
 *   • happy path — a `procedureType:'fixed'` client with fixedPrice = amountBeforeVat,
 *     the srv_fixed_* service shape, plan stamped, the CF-only link record written;
 *   • IDEMPOTENCY — a 2nd call with an existing link returns {created:false,sameCase},
 *     and transaction.create is NOT called;
 *   • fail-closed preconditions — sale not found, amountBeforeVat null;
 *   • auth gates — non-admin (incl. legacy admin:true-only), unauth;
 *   • AUDIT-FIRST in-txn — the audit is written before the create in the SAME txn;
 *   • NO financial PII on the clients doc (no raw amount/agreedFee field);
 *   • NO PII (amount/name/idNumber) in any logger payload (static + runtime guards).
 */
import * as fs from 'fs';
import * as path from 'path';
import { type CallableRequest } from 'firebase-functions/v2/https';

// ─── Mock the SSOT tofes read (no real cross-project call) ───────────────────
const mockReadSalesRecord = jest.fn();
jest.mock('../tofes-mecher/validate-sales-record', () => ({
  __esModule: true,
  readSalesRecordSnapshot: (...args: unknown[]) => mockReadSalesRecord(...args)
}));

// ─── Mock the audit primitive (in-txn) ───────────────────────────────────────
const mockLogCriticalInTxn = jest.fn();
jest.mock('../audit-critical', () => ({
  logCriticalActionInTxn: (...args: unknown[]) => mockLogCriticalInTxn(...args)
}));

// ─── Mock the secret (fake key — asserted to never reach logs) ───────────────
const FAKE_KEY = '{"fake":"sa-key-DO-NOT-LOG"}';
jest.mock('firebase-functions/params', () => ({
  defineSecret: () => ({ value: () => FAKE_KEY })
}));

// ─── Mock firebase-admin (firestore + transaction + employee query) ──────────
// Transaction primitives — recorded so tests assert ordering + the written shapes.
type WriteOp = { op: 'set' | 'create'; path: string; data: Record<string, unknown>; opts?: unknown };
let writeOps: WriteOp[];
let txnGetResponses: Map<string, { exists: boolean; data?: () => Record<string, unknown> }>;
let employeeQueryResult: { empty: boolean; docs: Array<{ data: () => Record<string, unknown> }> };
let runTransactionImpl: ((fn: (txn: unknown) => Promise<unknown>) => Promise<unknown>) | null;

function refFor(path: string) {
  return { __path: path, id: path.split('/').pop() ?? path };
}

const mockTransaction = {
  get: jest.fn(async (ref: { __path: string }) => {
    const resp = txnGetResponses.get(ref.__path);
    return resp ?? { exists: false };
  }),
  set: jest.fn((ref: { __path: string }, data: Record<string, unknown>, opts?: unknown) => {
    writeOps.push({ op: 'set', path: ref.__path, data, opts });
  }),
  create: jest.fn((ref: { __path: string }, data: Record<string, unknown>) => {
    writeOps.push({ op: 'create', path: ref.__path, data });
  })
};

function makeDb() {
  return {
    collection: (col: string) => ({
      doc: (id: string) => refFor(`${col}/${id}`),
      // employee lookup: .where().limit().get()
      where: () => ({
        limit: () => ({
          get: async () => employeeQueryResult
        })
      })
    }),
    runTransaction: (fn: (txn: unknown) => Promise<unknown>) =>
      (runTransactionImpl ?? (async (f) => f(mockTransaction)))(fn)
  };
}

jest.mock('firebase-admin', () => {
  const firestoreFn = () => makeDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (firestoreFn as any).FieldValue = { serverTimestamp: () => 'TS_SENTINEL' };
  return { firestore: firestoreFn };
});

// ─── Capture every logger payload (no-PII runtime scan) ──────────────────────
const loggerCalls: string[] = [];
jest.mock('../../shared/logger', () => ({
  info: (...a: unknown[]) => { loggerCalls.push(JSON.stringify(a)); },
  warn: (...a: unknown[]) => { loggerCalls.push(JSON.stringify(a)); },
  error: (...a: unknown[]) => { loggerCalls.push(JSON.stringify(a)); }
}));

// Import AFTER the mocks are registered.
import {
  createClientFromSalesRecordHandler,
  createClientFromSalesRecordInputSchema
} from '../cutover/create-client-from-sales-record';

const ADMIN_UID = 'admin-uid-test-fixture-001';
const VALID_ID = 'AbCdEf0123456789wxyz'; // 20-char tofes auto-id shape

// Sentinel PII — the runtime scan asserts NONE of these reach logger.* (and the
// no-financial-PII test asserts no raw amount field is written to the clients doc).
const PII = {
  clientName: 'CLIENTNAME-SENTINEL',
  idNumber: 'IDNUM-SENTINEL-123456789'
};
const AMOUNT = 4250; // amountBeforeVat sentinel

function makeReq(
  data: unknown = { salesRecordId: VALID_ID },
  token: Record<string, unknown> | null = { role: 'admin' },
  uid = ADMIN_UID
): CallableRequest<unknown> {
  return { auth: token ? { uid, token } : null, data } as unknown as CallableRequest<unknown>;
}

function foundSale(extra: Record<string, unknown> = {}) {
  return {
    exists: true,
    salesRecordId: VALID_ID,
    clientName: PII.clientName,
    idNumber: PII.idNumber,
    amountBeforeVat: AMOUNT,
    vatAmount: 722.5,
    amountWithVat: 4972.5,
    amount: 4972.5,
    transactionType: 'מכר דירה',
    timestampIso: '2026-01-02T03:04:05.000Z',
    ...extra
  };
}

/** The clients doc as written to transaction.create (the only `clients/*` create). */
function writtenClientDoc(): Record<string, unknown> {
  const op = writeOps.find((w) => w.op === 'create' && w.path.startsWith('clients/'));
  if (!op) throw new Error('no clients create captured');
  return op.data;
}

/** The sales_record_links doc as written. */
function writtenLinkDoc(): Record<string, unknown> {
  const op = writeOps.find((w) => w.op === 'set' && w.path.startsWith('sales_record_links/'));
  if (!op) throw new Error('no link set captured');
  return op.data;
}

beforeEach(() => {
  jest.clearAllMocks();
  loggerCalls.length = 0;
  writeOps = [];
  // Default txn reads: link absent (so a create happens), counter at year 2026 #5.
  txnGetResponses = new Map();
  txnGetResponses.set(`sales_record_links/${VALID_ID}`, { exists: false });
  txnGetResponses.set('_system/caseNumberCounter', {
    exists: true,
    data: () => ({ year: new Date().getFullYear().toString(), lastNumber: 5, _stats: { totalTransactions: 5 } })
  });
  employeeQueryResult = { empty: false, docs: [{ data: () => ({ username: 'admin-display' }) }] };
  runTransactionImpl = null; // default passthrough to mockTransaction
  mockReadSalesRecord.mockResolvedValue(foundSale());
  mockLogCriticalInTxn.mockReturnValue('audit-doc-id');
});

const EXPECTED_CASE = `${new Date().getFullYear()}006`; // lastNumber 5 → 6

// ════════════════════════════════════════════════════════════════════════════
// (a) Static AST invariants — no PII to logger.*, audit-FIRST present
// ════════════════════════════════════════════════════════════════════════════
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

describe('create-client-from-sales-record — static AST invariants', () => {
  let code: string;
  beforeAll(() => {
    code = stripComments(fs.readFileSync(
      path.resolve(__dirname, '../cutover/create-client-from-sales-record.ts'), 'utf8'
    ));
  });

  it('is a v2 onCall declaring the tofes secret', () => {
    expect(code).toContain('onCall');
    expect(code).toMatch(/secrets:\s*\[TOFES_KEY\]/);
  });

  it('role-only admin gate, rejects non-admin (no legacy admin:true acceptance)', () => {
    expect(code).toMatch(/claims\.role !== 'admin'/);
    expect(code).not.toMatch(/\.admin === true/);
  });

  it('audits via logCriticalActionInTxn with a non-PII payload (business ids only)', () => {
    expect(code).toContain('logCriticalActionInTxn');
    expect(code).toMatch(/logCriticalActionInTxn\([^)]*salesRecordId/);
  });

  it('NEVER passes PII to any logger.* call (clientName/idNumber/amounts/contact)', () => {
    const forbidden = [
      'clientName', 'idNumber', 'amountBeforeVat', 'vatAmount',
      'amountWithVat', 'fixedPrice', 'agreedFee', 'phone', 'email', 'address'
    ];
    for (const ident of forbidden) {
      const re = new RegExp(`logger\\.\\w+\\([^)]*${ident}`);
      expect(code).not.toMatch(re);
    }
  });

  it('NEVER logs raw error.message/.stack or the secret value', () => {
    expect(code).not.toMatch(/logger\.\w+\([^)]*\.message/);
    expect(code).not.toMatch(/logger\.\w+\([^)]*\.stack/);
    expect(code).not.toMatch(/logger\.\w+\([^)]*\.value\(\)/);
    expect(code).not.toMatch(/logger\.\w+\([^)]*TOFES_KEY/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (b) Input schema (Zod strict)
// ════════════════════════════════════════════════════════════════════════════
describe('createClientFromSalesRecord — input schema', () => {
  it('accepts a 20-char alphanumeric id; rejects wrong-length / charset / extra / missing', () => {
    expect(createClientFromSalesRecordInputSchema.safeParse({ salesRecordId: VALID_ID }).success).toBe(true);
    expect(createClientFromSalesRecordInputSchema.safeParse({ salesRecordId: 'tooshort' }).success).toBe(false);
    expect(createClientFromSalesRecordInputSchema.safeParse({ salesRecordId: 'AbCdEf0123456789wxy/' }).success).toBe(false);
    expect(createClientFromSalesRecordInputSchema.safeParse({ salesRecordId: VALID_ID, extra: 1 }).success).toBe(false);
    expect(createClientFromSalesRecordInputSchema.safeParse({}).success).toBe(false);
  });

  it('handler throws invalid-argument on a malformed id (no read, no txn)', async () => {
    await expect(createClientFromSalesRecordHandler(makeReq({ salesRecordId: 'bad' })))
      .rejects.toMatchObject({ code: 'invalid-argument' });
    expect(mockReadSalesRecord).not.toHaveBeenCalled();
    expect(mockTransaction.create).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (c) Auth gates
// ════════════════════════════════════════════════════════════════════════════
describe('createClientFromSalesRecord — auth gates', () => {
  it('rejects unauthenticated', async () => {
    await expect(createClientFromSalesRecordHandler(makeReq(undefined, null)))
      .rejects.toMatchObject({ code: 'unauthenticated' });
    expect(mockReadSalesRecord).not.toHaveBeenCalled();
  });

  it('rejects a non-admin (employee)', async () => {
    await expect(createClientFromSalesRecordHandler(makeReq(undefined, { role: 'employee' })))
      .rejects.toMatchObject({ code: 'permission-denied' });
    expect(mockReadSalesRecord).not.toHaveBeenCalled();
  });

  it('REJECTS legacy admin:true-only token (role-only gate)', async () => {
    await expect(createClientFromSalesRecordHandler(makeReq(undefined, { admin: true })))
      .rejects.toThrow('רק מנהל מערכת רשאי ליצור לקוח ממכר.');
  });

  it('accepts admin via canonical role:admin', async () => {
    const res = await createClientFromSalesRecordHandler(makeReq());
    expect(res.created).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (d) Fail-closed preconditions
// ════════════════════════════════════════════════════════════════════════════
describe('createClientFromSalesRecord — fail-closed preconditions', () => {
  it('sale not found → failed-precondition (no txn)', async () => {
    mockReadSalesRecord.mockResolvedValueOnce({ exists: false });
    await expect(createClientFromSalesRecordHandler(makeReq()))
      .rejects.toMatchObject({ code: 'failed-precondition' });
    expect(mockTransaction.create).not.toHaveBeenCalled();
  });

  it('amountBeforeVat null → failed-precondition (no txn)', async () => {
    mockReadSalesRecord.mockResolvedValueOnce(foundSale({ amountBeforeVat: null }));
    await expect(createClientFromSalesRecordHandler(makeReq()))
      .rejects.toThrow('לרשומת המכר אין סכום (לפני מע"מ); לא ניתן ליצור שירות. יש להזין ידנית.');
    expect(mockTransaction.create).not.toHaveBeenCalled();
  });

  it('amountBeforeVat NaN/non-finite → failed-precondition', async () => {
    mockReadSalesRecord.mockResolvedValueOnce(foundSale({ amountBeforeVat: Number.NaN }));
    await expect(createClientFromSalesRecordHandler(makeReq()))
      .rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('amountBeforeVat 0 is a VALID fee (a free fixed service is created)', async () => {
    mockReadSalesRecord.mockResolvedValueOnce(foundSale({ amountBeforeVat: 0 }));
    const res = await createClientFromSalesRecordHandler(makeReq());
    expect(res.created).toBe(true);
    expect(writtenClientDoc().services).toMatchObject([{ fixedPrice: 0 }]);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (e) Happy path — the FIXED clientData shape + plan + link record
// ════════════════════════════════════════════════════════════════════════════
describe('createClientFromSalesRecord — happy path (create)', () => {
  it('creates a procedureType:fixed client with the canonical service shape', async () => {
    const res = await createClientFromSalesRecordHandler(makeReq());
    expect(res).toEqual({ created: true, caseNumber: EXPECTED_CASE, serviceId: `srv_fixed_${VALID_ID}` });

    const doc = writtenClientDoc();
    expect(doc).toMatchObject({
      caseNumber: EXPECTED_CASE,
      clientName: PII.clientName,
      fullName: PII.clientName,
      idNumber: PII.idNumber,
      caseTitle: 'מכר דירה',
      procedureType: 'fixed',
      status: 'active',
      priority: 'medium',
      mainAttorney: 'admin-display',
      createdBy: 'admin-display',
      assignedTo: ['admin-display'],
      totalServices: 1,
      activeServices: 1,
      isOnHold: false
    });
    expect(doc.services).toEqual([
      {
        id: `srv_fixed_${VALID_ID}`,
        type: 'fixed',
        name: 'שירות קבוע',
        description: '',
        status: 'active',
        createdAt: expect.any(String),
        createdBy: 'admin-display',
        fixedPrice: AMOUNT,
        work: { totalMinutesWorked: 0, entriesCount: 0 },
        completedAt: null,
        salesRecordId: VALID_ID
      }
    ]);
  });

  it('stamps the static Plan (computeClientPlan over the fixed service)', async () => {
    await createClientFromSalesRecordHandler(makeReq());
    const plan = writtenClientDoc().plan as Record<string, unknown>;
    // a single fixed service → expectedRevenue = fixedPrice, pricingComplete, 1 service
    expect(plan).toMatchObject({
      expectedRevenue: AMOUNT,
      pricingComplete: true,
      pricingMissingCount: 0,
      serviceCount: 1
    });
  });

  it('writes the CF-only link record with the financial snapshot', async () => {
    await createClientFromSalesRecordHandler(makeReq());
    expect(writtenLinkDoc()).toEqual({
      salesRecordId: VALID_ID,
      caseNumber: EXPECTED_CASE,
      serviceId: `srv_fixed_${VALID_ID}`,
      agreedFeeSnapshot: AMOUNT,
      feeFieldUsed: 'amountBeforeVat',
      // The SALE's own timestamp (from the fixture), NOT the current wall-clock —
      // proves the link captures the sale's timestamp for DLR drift-detection.
      salesRecordTimestampIso: '2026-01-02T03:04:05.000Z',
      snapshotAt: 'TS_SENTINEL',
      confirmedBy: ADMIN_UID,
      state: 'matched',
      schemaVersion: 1
    });
  });

  it('allocates the caseNumber from the _system counter (lastNumber+1, padded)', async () => {
    await createClientFromSalesRecordHandler(makeReq());
    const counterSet = writeOps.find((w) => w.path === '_system/caseNumberCounter');
    expect(counterSet).toBeDefined();
    const counter = counterSet as WriteOp;
    expect(counter.data).toMatchObject({ lastNumber: 6, _stats: expect.objectContaining({ lastCaseNumber: EXPECTED_CASE }) });
    expect(counter.opts).toEqual({ merge: true });
  });

  it('uses .create() (not .set()) for the client doc (no silent overwrite)', async () => {
    await createClientFromSalesRecordHandler(makeReq());
    const clientOps = writeOps.filter((w) => w.path.startsWith('clients/'));
    expect(clientOps).toHaveLength(1);
    expect(clientOps[0].op).toBe('create');
  });

  it('falls back to uid for createdBy when the employee doc is absent', async () => {
    employeeQueryResult = { empty: true, docs: [] };
    await createClientFromSalesRecordHandler(makeReq());
    expect(writtenClientDoc().createdBy).toBe(ADMIN_UID);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (f) Idempotency — an existing link → no second client
// ════════════════════════════════════════════════════════════════════════════
describe('createClientFromSalesRecord — idempotency', () => {
  it('a 2nd call with an existing link returns {created:false, sameCase} and creates NO client', async () => {
    txnGetResponses.set(`sales_record_links/${VALID_ID}`, {
      exists: true,
      data: () => ({ caseNumber: '2026042', serviceId: `srv_fixed_${VALID_ID}` })
    });
    const res = await createClientFromSalesRecordHandler(makeReq());
    expect(res).toEqual({ created: false, caseNumber: '2026042', serviceId: `srv_fixed_${VALID_ID}` });
    expect(mockTransaction.create).not.toHaveBeenCalled();
    // no counter bump, no new link write
    expect(writeOps.filter((w) => w.path.startsWith('clients/'))).toHaveLength(0);
    expect(writeOps.filter((w) => w.path.startsWith('sales_record_links/'))).toHaveLength(0);
  });

  it('the idempotent no-op does NOT write an audit (no create → nothing to audit)', async () => {
    txnGetResponses.set(`sales_record_links/${VALID_ID}`, {
      exists: true,
      data: () => ({ caseNumber: '2026042', serviceId: 'srv_fixed_x' })
    });
    await createClientFromSalesRecordHandler(makeReq());
    expect(mockLogCriticalInTxn).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (g) AUDIT-FIRST in-txn — audit written before the client create
// ════════════════════════════════════════════════════════════════════════════
describe('createClientFromSalesRecord — audit-FIRST (in transaction)', () => {
  it('logCriticalActionInTxn runs BEFORE transaction.create (same txn)', async () => {
    const order: string[] = [];
    mockLogCriticalInTxn.mockImplementation(() => {
      order.push('audit');
      return 'audit-id';
    });
    mockTransaction.create.mockImplementation((ref: { __path: string }, data: Record<string, unknown>) => {
      if (ref.__path.startsWith('clients/')) order.push('create');
      writeOps.push({ op: 'create', path: ref.__path, data });
    });
    await createClientFromSalesRecordHandler(makeReq());
    expect(order).toEqual(['audit', 'create']);
  });

  it('the audit payload is non-PII (salesRecordId + caseNumber + serviceId only)', async () => {
    await createClientFromSalesRecordHandler(makeReq());
    expect(mockLogCriticalInTxn).toHaveBeenCalledWith(
      mockTransaction,
      'CREATE_CLIENT_FROM_SALES_RECORD',
      ADMIN_UID,
      { salesRecordId: VALID_ID, caseNumber: EXPECTED_CASE, serviceId: `srv_fixed_${VALID_ID}` }
    );
    const blob = JSON.stringify(mockLogCriticalInTxn.mock.calls[0]);
    expect(blob).not.toContain(PII.clientName);
    expect(blob).not.toContain(PII.idNumber);
    expect(blob).not.toContain(String(AMOUNT));
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (h) NO financial PII on the world-readable clients doc
// ════════════════════════════════════════════════════════════════════════════
describe('createClientFromSalesRecord — no financial PII on the clients doc', () => {
  it('the created client doc has NO raw amount/agreedFee field (fee only via service.fixedPrice)', async () => {
    await createClientFromSalesRecordHandler(makeReq());
    const doc = writtenClientDoc();
    // none of these confidential-fee field names appear at the client-doc root
    for (const k of ['amountBeforeVat', 'vatAmount', 'amountWithVat', 'amount', 'agreedFee', 'agreedFeeSnapshot']) {
      expect(doc).not.toHaveProperty(k);
    }
    // the fee lives ONLY inside the service element as fixedPrice
    expect((doc.services as Array<{ fixedPrice: number }>)[0].fixedPrice).toBe(AMOUNT);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (i) Failure paths (Hebrew, sanitized)
// ════════════════════════════════════════════════════════════════════════════
describe('createClientFromSalesRecord — failure paths', () => {
  it('a transaction failure → Hebrew internal error', async () => {
    runTransactionImpl = async () => { throw { code: 'aborted' }; };
    await expect(createClientFromSalesRecordHandler(makeReq())).rejects.toMatchObject({ code: 'internal' });
  });

  it('an HttpsError thrown inside the txn (e.g. counter exhausted) propagates unchanged', async () => {
    // year-matched counter at 999 → next would be 1000 → resource-exhausted HttpsError
    txnGetResponses.set('_system/caseNumberCounter', {
      exists: true,
      data: () => ({ year: new Date().getFullYear().toString(), lastNumber: 999 })
    });
    runTransactionImpl = async (fn) => fn(mockTransaction); // run the real body
    await expect(createClientFromSalesRecordHandler(makeReq())).rejects.toMatchObject({ code: 'resource-exhausted' });
  });

  it('a tofes credential init failure → Hebrew internal (no key fragment logged)', async () => {
    const { TofesMecherCredentialError } = jest.requireActual('../tofes-mecher/app');
    mockReadSalesRecord.mockRejectedValueOnce(new TofesMecherCredentialError());
    await expect(createClientFromSalesRecordHandler(makeReq())).rejects.toMatchObject({ code: 'internal' });
  });

  it('a tofes read failure → Hebrew unavailable', async () => {
    mockReadSalesRecord.mockRejectedValueOnce({ code: 'permission-denied' });
    await expect(createClientFromSalesRecordHandler(makeReq())).rejects.toMatchObject({ code: 'unavailable' });
    expect(mockTransaction.create).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (j) Runtime no-PII-in-logs serialization scan
// ════════════════════════════════════════════════════════════════════════════
describe('createClientFromSalesRecord — no PII in logs (runtime)', () => {
  it('no PII value (name/idNumber/amount/key) reaches any logger.* across success/failure', async () => {
    await createClientFromSalesRecordHandler(makeReq());                                  // happy
    mockReadSalesRecord.mockResolvedValueOnce({ exists: false });
    await createClientFromSalesRecordHandler(makeReq()).catch(() => undefined);            // not found
    mockReadSalesRecord.mockResolvedValueOnce(foundSale({ amountBeforeVat: null }));
    await createClientFromSalesRecordHandler(makeReq()).catch(() => undefined);            // missing amount
    mockReadSalesRecord.mockRejectedValueOnce({ code: 'x' });
    await createClientFromSalesRecordHandler(makeReq()).catch(() => undefined);            // read fail

    const blob = loggerCalls.join(' ');
    expect(loggerCalls.length).toBeGreaterThan(0);
    expect(blob).not.toContain(PII.clientName);
    expect(blob).not.toContain(PII.idNumber);
    expect(blob).not.toContain(String(AMOUNT));
    expect(blob).not.toContain('sa-key'); // the fake secret value
  });
});
