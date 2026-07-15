/**
 * releaseClientFromPendingSignature — Phase 2 H.6.c-3 tests
 * ─────────────────────────────────────────────────────────────────────────────
 * Mocks every external boundary (the SHARED H.5 core `verifySignatureCore`, the
 * SSOT tofes read, firebase-admin firestore/transaction, the secrets, the audit
 * primitive, the logger) so NO real AI egress, cross-project call, or Firestore
 * write occurs (Engineering Bar §2.3 "mock the SDK boundary, not the logic").
 *
 * Covers the customer scenario (G4): an admin clicks "בדוק חתימה ואשר" on a
 * pending client → the CF verifies the last-uploaded agreement, and either
 * releases the client (status flip + sales_record_links write) or reports why
 * not — plus the security-critical invariants: `reasoning` NEVER crosses the
 * wire or reaches Firestore, audit-FIRST in-txn, TOCTOU-safe idempotency, and
 * the fee-drift guard.
 */
import * as fs from 'fs';
import * as path from 'path';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';

// ─── Mock the SHARED H.5 core (no real AI egress) ─────────────────────────────
const mockVerifyCore = jest.fn();
jest.mock('../signatures/verify-signature-presence', () => ({
  __esModule: true,
  verifySignatureCore: (...args: unknown[]) => mockVerifyCore(...args)
}));

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

// ─── Mock the secrets (fake values — asserted to never reach logs) ───────────
const FAKE_ANTHROPIC_KEY = 'sk-ant-fake-key-DO-NOT-LOG';
const FAKE_TOFES_KEY = '{"fake":"sa-key-DO-NOT-LOG"}';
jest.mock('firebase-functions/params', () => ({
  defineSecret: (name: string) => ({
    value: () => (name === 'ANTHROPIC_API_KEY' ? FAKE_ANTHROPIC_KEY : FAKE_TOFES_KEY)
  })
}));

// ─── Mock firebase-admin (firestore + transaction) ────────────────────────────
type WriteOp = { op: 'set' | 'create' | 'update'; path: string; data: Record<string, unknown> };
type DocResp = { exists: boolean; data?: () => Record<string, unknown> };

let writeOps: WriteOp[];
let docResponses: Map<string, DocResp>;
let docResponseQueues: Map<string, DocResp[]>;
let runTransactionImpl: ((fn: (txn: unknown) => Promise<unknown>) => Promise<unknown>) | null;

function getDocResponse(p: string): DocResp {
  const q = docResponseQueues.get(p);
  if (q && q.length > 0) {
    return q.shift() as DocResp;
  }
  return docResponses.get(p) ?? { exists: false };
}

function refFor(p: string) {
  return {
    __path: p,
    id: p.split('/').pop() ?? p,
    get: async () => getDocResponse(p)
  };
}

const mockTransaction = {
  get: jest.fn(async (ref: { __path: string }) => getDocResponse(ref.__path)),
  update: jest.fn((ref: { __path: string }, data: Record<string, unknown>) => {
    writeOps.push({ op: 'update', path: ref.__path, data });
  }),
  create: jest.fn((ref: { __path: string }, data: Record<string, unknown>) => {
    writeOps.push({ op: 'create', path: ref.__path, data });
  })
};

function makeDb() {
  return {
    collection: (col: string) => ({
      doc: (id: string) => refFor(`${col}/${id}`)
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
  releaseClientFromPendingSignatureHandler,
  releaseClientFromPendingSignatureInputSchema
} from '../cutover/release-client-from-pending-signature';

const ADMIN_UID = 'admin-uid-test-fixture-002';
const VALID_ID = 'AbCdEf0123456789wxyz'; // 20-char tofes auto-id shape
const CASE_NUMBER = '2026123';
const SERVICE_ID = `srv_fixed_${VALID_ID}`;
const AGREEMENT_ID = 'agreement_last_001';

// Sentinel PII — the runtime + AST guards assert this NEVER reaches the wire or
// any Firestore write.
const REASONING_SENTINEL = 'נראות חתימת ישראל ישראלי בתחתית העמוד — REASONING-SENTINEL';
const AMOUNT = 4250; // amountBeforeVat sentinel

function makeReq(
  data: unknown = { salesRecordId: VALID_ID },
  token: Record<string, unknown> | null = { role: 'admin' },
  uid = ADMIN_UID
): CallableRequest<unknown> {
  return { auth: token ? { uid, token } : null, data } as unknown as CallableRequest<unknown>;
}

function intentDoc(extra: Record<string, unknown> = {}): DocResp {
  return {
    exists: true,
    data: () => ({ caseNumber: CASE_NUMBER, serviceId: SERVICE_ID, ...extra })
  };
}

function pendingClientDoc(extra: Record<string, unknown> = {}): DocResp {
  return {
    exists: true,
    data: () => ({
      status: 'pending_signature',
      feeAgreements: [
        { id: 'agreement_older_000', storagePath: `clients/${CASE_NUMBER}/agreements/agreement_older_000.pdf` },
        { id: AGREEMENT_ID, storagePath: `clients/${CASE_NUMBER}/agreements/${AGREEMENT_ID}.pdf` }
      ],
      services: [{ id: SERVICE_ID, status: 'pending', fixedPrice: AMOUNT }],
      ...extra
    })
  };
}

function passedVerdict(extra: Record<string, unknown> = {}) {
  return {
    clientSignaturePresent: true,
    lawyerSignaturePresent: true,
    confidence: 0.95,
    reasoning: REASONING_SENTINEL,
    passed: true,
    ...extra
  };
}

function foundSale(extra: Record<string, unknown> = {}) {
  return {
    exists: true,
    salesRecordId: VALID_ID,
    clientName: 'CLIENTNAME-SENTINEL',
    idNumber: 'IDNUM-SENTINEL',
    amountBeforeVat: AMOUNT,
    vatAmount: 722.5,
    amountWithVat: AMOUNT + 722.5,
    amount: AMOUNT + 722.5,
    transactionType: 'מכר דירה',
    timestampIso: '2026-01-02T03:04:05.000Z',
    ...extra
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  loggerCalls.length = 0;
  writeOps = [];
  docResponses = new Map();
  docResponseQueues = new Map();
  runTransactionImpl = null;

  docResponses.set(`pending_signature_intents/${VALID_ID}`, intentDoc());
  docResponses.set(`clients/${CASE_NUMBER}`, pendingClientDoc());

  mockVerifyCore.mockResolvedValue(passedVerdict());
  mockReadSalesRecord.mockResolvedValue(foundSale());
  mockLogCriticalInTxn.mockReturnValue('audit-doc-id');
});

function writtenLinkDoc(): Record<string, unknown> {
  const op = writeOps.find((w) => w.op === 'create' && w.path.startsWith('sales_record_links/'));
  if (!op) throw new Error('no sales_record_links create captured');
  return op.data;
}

function writtenClientUpdate(): Record<string, unknown> {
  const op = writeOps.find((w) => w.op === 'update' && w.path === `clients/${CASE_NUMBER}`);
  if (!op) throw new Error('no clients update captured');
  return op.data;
}

// ════════════════════════════════════════════════════════════════════════════
// Static AST invariants
// ════════════════════════════════════════════════════════════════════════════
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

describe('release-client-from-pending-signature — static AST invariants', () => {
  let code: string;
  beforeAll(() => {
    code = stripComments(fs.readFileSync(
      path.resolve(__dirname, '../cutover/release-client-from-pending-signature.ts'), 'utf8'
    ));
  });

  it('is a v2 onCall declaring both secrets, maxInstances:3, timeoutSeconds:120', () => {
    expect(code).toContain('onCall');
    expect(code).toMatch(/secrets:\s*\[ANTHROPIC_KEY,\s*TOFES_KEY\]/);
    expect(code).toMatch(/maxInstances:\s*3/);
    expect(code).toMatch(/timeoutSeconds:\s*120/);
  });

  it('role-only admin gate, rejects non-admin (no legacy admin:true acceptance)', () => {
    expect(code).toMatch(/claims\.role !== 'admin'/);
    expect(code).not.toMatch(/\.admin === true/);
  });

  it('audits via logCriticalActionInTxn with a non-PII payload', () => {
    expect(code).toContain('logCriticalActionInTxn');
    expect(code).toMatch(/logCriticalActionInTxn\([^)]*salesRecordId/);
  });

  it('NEVER returns/writes `reasoning` anywhere in the source (grep-level guard)', () => {
    // The word "reasoning" must not appear at all in this file's source — the
    // verdict's reasoning field is read (via `verdict.passed`/booleans/confidence
    // only) but never referenced by name here, so this is a strict content guard.
    expect(code).not.toMatch(/reasoning/i);
  });

  it('NEVER passes PII (amounts/PII) to any logger.* call', () => {
    const forbidden = ['clientName', 'idNumber', 'amountBeforeVat', 'vatAmount', 'amountWithVat'];
    for (const ident of forbidden) {
      const re = new RegExp(`logger\\.\\w+\\([^)]*${ident}`);
      expect(code).not.toMatch(re);
    }
  });

  it('NEVER logs raw error.message/.stack or a secret value', () => {
    expect(code).not.toMatch(/logger\.\w+\([^)]*\.message/);
    expect(code).not.toMatch(/logger\.\w+\([^)]*\.stack/);
    expect(code).not.toMatch(/logger\.\w+\([^)]*\.value\(\)/);
  });

  it('writes sales_record_links via .create() (race-safe, not .set())', () => {
    expect(code).toMatch(/transaction\.create\(linksRef/);
  });

  it('computes activeServices (no hardcoded literal assignment)', () => {
    expect(code).toMatch(/activeServices\s*=\s*updatedServices\.filter/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Input schema
// ════════════════════════════════════════════════════════════════════════════
describe('releaseClientFromPendingSignature — input schema', () => {
  it('accepts a 20-char alphanumeric id; rejects wrong-length / charset / extra / missing', () => {
    expect(releaseClientFromPendingSignatureInputSchema.safeParse({ salesRecordId: VALID_ID }).success).toBe(true);
    expect(releaseClientFromPendingSignatureInputSchema.safeParse({ salesRecordId: 'short' }).success).toBe(false);
    expect(releaseClientFromPendingSignatureInputSchema.safeParse({ salesRecordId: VALID_ID, extra: 1 }).success).toBe(false);
    expect(releaseClientFromPendingSignatureInputSchema.safeParse({}).success).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Auth gates
// ════════════════════════════════════════════════════════════════════════════
describe('releaseClientFromPendingSignature — auth gates', () => {
  it('rejects unauthenticated', async () => {
    await expect(releaseClientFromPendingSignatureHandler(makeReq(undefined, null)))
      .rejects.toMatchObject({ code: 'unauthenticated' });
    expect(mockVerifyCore).not.toHaveBeenCalled();
  });

  it('rejects a non-admin employee', async () => {
    await expect(releaseClientFromPendingSignatureHandler(makeReq(undefined, { role: 'employee' })))
      .rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rejects legacy admin:true-only token (role-only gate)', async () => {
    await expect(releaseClientFromPendingSignatureHandler(makeReq(undefined, { admin: true })))
      .rejects.toThrow('רק מנהל מערכת רשאי לאשר לקוח לאחר בדיקת חתימה.');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// No pending intent
// ════════════════════════════════════════════════════════════════════════════
describe('releaseClientFromPendingSignature — no pending intent', () => {
  it('rejects with not-found and never calls the signature core', async () => {
    docResponses.set(`pending_signature_intents/${VALID_ID}`, { exists: false });
    await expect(releaseClientFromPendingSignatureHandler(makeReq()))
      .rejects.toMatchObject({ code: 'not-found' });
    expect(mockVerifyCore).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// No feeAgreements — rejected before the AI call
// ════════════════════════════════════════════════════════════════════════════
describe('releaseClientFromPendingSignature — no feeAgreements uploaded', () => {
  it('rejects before calling verifySignatureCore', async () => {
    docResponses.set(`clients/${CASE_NUMBER}`, pendingClientDoc({ feeAgreements: [] }));
    await expect(releaseClientFromPendingSignatureHandler(makeReq()))
      .rejects.toThrow('טרם הועלה הסכם שכר טרחה חתום עבור לקוח זה.');
    expect(mockVerifyCore).not.toHaveBeenCalled();
  });

  it('rejects when the client is not in pending_signature status', async () => {
    docResponses.set(`clients/${CASE_NUMBER}`, pendingClientDoc({ status: 'active' }));
    await expect(releaseClientFromPendingSignatureHandler(makeReq()))
      .rejects.toThrow('הלקוח אינו ממתין לבדיקת חתימה.');
    expect(mockVerifyCore).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Verify fails — client stays pending, no links, no reasoning on the wire
// ════════════════════════════════════════════════════════════════════════════
describe('releaseClientFromPendingSignature — signature verdict failed', () => {
  it('returns released:false + the booleans/confidence, WITHOUT reasoning', async () => {
    mockVerifyCore.mockResolvedValueOnce(passedVerdict({ passed: false, lawyerSignaturePresent: false }));
    const res = await releaseClientFromPendingSignatureHandler(makeReq());
    expect(res).toEqual({
      released: false,
      clientSignaturePresent: true,
      lawyerSignaturePresent: false,
      confidence: 0.95
    });
    expect(res).not.toHaveProperty('reasoning');
    expect(JSON.stringify(res)).not.toContain(REASONING_SENTINEL);
    expect(writeOps).toHaveLength(0);
    expect(mockReadSalesRecord).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Sale deleted from tofes
// ════════════════════════════════════════════════════════════════════════════
describe('releaseClientFromPendingSignature — sale missing from tofes', () => {
  it('rejects with failed-precondition, no txn write', async () => {
    mockReadSalesRecord.mockResolvedValueOnce({ exists: false });
    await expect(releaseClientFromPendingSignatureHandler(makeReq()))
      .rejects.toThrow('רשומת המכר לא נמצאה במערכת המקור. לא ניתן לשחרר את הלקוח.');
    expect(writeOps).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Fee drift
// ════════════════════════════════════════════════════════════════════════════
describe('releaseClientFromPendingSignature — fee drift', () => {
  it('rejects when the sale amount differs from the service fixedPrice beyond tolerance', async () => {
    mockReadSalesRecord.mockResolvedValueOnce(foundSale({ amountBeforeVat: AMOUNT + 500 }));
    await expect(releaseClientFromPendingSignatureHandler(makeReq()))
      .rejects.toThrow('סכום העסקה במערכת המכר שונה מהסכום שנרשם בלקוח. נא לבדוק ולעדכן.');
    expect(writeOps).toHaveLength(0);
  });

  it('accepts a sub-₪1 rounding difference', async () => {
    mockReadSalesRecord.mockResolvedValueOnce(foundSale({ amountBeforeVat: AMOUNT + 0.4 }));
    const res = await releaseClientFromPendingSignatureHandler(makeReq());
    expect(res.released).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Idempotency — already released (TOCTOU)
// ════════════════════════════════════════════════════════════════════════════
describe('releaseClientFromPendingSignature — already released (idempotent no-op)', () => {
  it('a concurrent re-release returns {released:false, reason:CLIENT_ALREADY_RELEASED}, no error', async () => {
    // Outer pre-check read sees pending_signature; the in-txn re-read sees it was
    // already flipped to active by a concurrent call — queued per-path responses.
    docResponseQueues.set(`clients/${CASE_NUMBER}`, [
      pendingClientDoc(),
      { exists: true, data: () => ({ status: 'active' }) }
    ]);
    const res = await releaseClientFromPendingSignatureHandler(makeReq());
    expect(res).toEqual({ released: false, reason: 'CLIENT_ALREADY_RELEASED' });
    expect(writeOps).toHaveLength(0);
    expect(mockLogCriticalInTxn).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Happy path
// ════════════════════════════════════════════════════════════════════════════
describe('releaseClientFromPendingSignature — happy path (release)', () => {
  it('calls verifySignatureCore with the LAST-uploaded agreement id', async () => {
    await releaseClientFromPendingSignatureHandler(makeReq());
    expect(mockVerifyCore).toHaveBeenCalledWith(ADMIN_UID, CASE_NUMBER, AGREEMENT_ID, 'clients');
  });

  it('returns {released:true, caseNumber}', async () => {
    const res = await releaseClientFromPendingSignatureHandler(makeReq());
    expect(res).toEqual({ released: true, caseNumber: CASE_NUMBER });
  });

  it('flips the client to active and computes activeServices from the array', async () => {
    await releaseClientFromPendingSignatureHandler(makeReq());
    const update = writtenClientUpdate();
    expect(update.status).toBe('active');
    expect(update.activeServices).toBe(1);
    const services = update.services as Array<{ id: string; status: string }>;
    expect(services.find((s) => s.id === SERVICE_ID)?.status).toBe('active');
  });

  it('writes sales_record_links with the agreedFeeSnapshot from the LIVE sale (not the txn)', async () => {
    await releaseClientFromPendingSignatureHandler(makeReq());
    const link = writtenLinkDoc();
    expect(link).toMatchObject({
      caseNumber: CASE_NUMBER,
      salesRecordId: VALID_ID,
      serviceId: SERVICE_ID,
      feeFieldUsed: 'amountBeforeVat',
      confirmedBy: ADMIN_UID,
      state: 'matched'
    });
    expect(link.agreedFeeSnapshot).toMatchObject({ amountBeforeVat: AMOUNT });
  });

  it('creates the link via .create() (not .set())', async () => {
    await releaseClientFromPendingSignatureHandler(makeReq());
    const linkOps = writeOps.filter((w) => w.path.startsWith('sales_record_links/'));
    expect(linkOps).toHaveLength(1);
    expect(linkOps[0].op).toBe('create');
  });

  it('audit-FIRST: logCriticalActionInTxn runs BEFORE transaction.update/create', async () => {
    const order: string[] = [];
    mockLogCriticalInTxn.mockImplementation(() => {
      order.push('audit');
      return 'audit-id';
    });
    mockTransaction.update.mockImplementation((ref: { __path: string }, data: Record<string, unknown>) => {
      order.push('update');
      writeOps.push({ op: 'update', path: ref.__path, data });
    });
    mockTransaction.create.mockImplementation((ref: { __path: string }, data: Record<string, unknown>) => {
      order.push('create');
      writeOps.push({ op: 'create', path: ref.__path, data });
    });
    await releaseClientFromPendingSignatureHandler(makeReq());
    expect(order).toEqual(['audit', 'update', 'create']);
  });

  it('the audit payload is non-PII (business ids + booleans + confidence, NEVER reasoning/amount)', async () => {
    await releaseClientFromPendingSignatureHandler(makeReq());
    expect(mockLogCriticalInTxn).toHaveBeenCalledWith(
      mockTransaction,
      'RELEASE_CLIENT_FROM_PENDING_SIGNATURE',
      ADMIN_UID,
      {
        caseNumber: CASE_NUMBER,
        salesRecordId: VALID_ID,
        serviceId: SERVICE_ID,
        agreementId: AGREEMENT_ID,
        clientSignaturePresent: true,
        lawyerSignaturePresent: true,
        confidence: 0.95
      }
    );
    const blob = JSON.stringify(mockLogCriticalInTxn.mock.calls[0]);
    expect(blob).not.toContain(REASONING_SENTINEL);
    expect(blob).not.toContain(String(AMOUNT));
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Verified agreement / pending service re-check inside the transaction
// ════════════════════════════════════════════════════════════════════════════
describe('releaseClientFromPendingSignature — in-txn re-checks', () => {
  it('rejects if the verified agreement no longer exists on the fresh read', async () => {
    docResponseQueues.set(`clients/${CASE_NUMBER}`, [
      pendingClientDoc(),
      { exists: true, data: () => ({ status: 'pending_signature', feeAgreements: [], services: [{ id: SERVICE_ID, status: 'pending' }] }) }
    ]);
    await expect(releaseClientFromPendingSignatureHandler(makeReq()))
      .rejects.toThrow('הסכם שכר הטרחה שאומת אינו קיים עוד עבור לקוח זה. אנא נסה שוב.');
    expect(writeOps).toHaveLength(0);
  });

  it('rejects if the service is no longer pending on the fresh read', async () => {
    docResponseQueues.set(`clients/${CASE_NUMBER}`, [
      pendingClientDoc(),
      {
        exists: true,
        data: () => ({
          status: 'pending_signature',
          feeAgreements: [{ id: AGREEMENT_ID, storagePath: 'x' }],
          services: [{ id: SERVICE_ID, status: 'active' }]
        })
      }
    ]);
    await expect(releaseClientFromPendingSignatureHandler(makeReq()))
      .rejects.toThrow('השירות אינו במצב הממתין לשחרור.');
    expect(writeOps).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Failure paths
// ════════════════════════════════════════════════════════════════════════════
describe('releaseClientFromPendingSignature — failure paths', () => {
  it('a transaction failure → Hebrew internal error', async () => {
    runTransactionImpl = async () => { throw { code: 'aborted' }; };
    await expect(releaseClientFromPendingSignatureHandler(makeReq())).rejects.toMatchObject({ code: 'internal' });
  });

  it('an HttpsError thrown inside verifySignatureCore propagates unchanged', async () => {
    mockVerifyCore.mockRejectedValueOnce(new HttpsError('not-found', 'הלקוח לא נמצא במערכת.'));
    await expect(releaseClientFromPendingSignatureHandler(makeReq())).rejects.toMatchObject({ code: 'not-found' });
  });

  it('a non-HttpsError from verifySignatureCore maps to a Hebrew internal error', async () => {
    mockVerifyCore.mockRejectedValueOnce(new Error('boom'));
    await expect(releaseClientFromPendingSignatureHandler(makeReq())).rejects.toMatchObject({ code: 'internal' });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Runtime no-PII / no-reasoning-in-logs scan
// ════════════════════════════════════════════════════════════════════════════
describe('releaseClientFromPendingSignature — reasoning never on the wire (runtime)', () => {
  it('the reasoning sentinel never appears in logs, writes, or the response across every path', async () => {
    await releaseClientFromPendingSignatureHandler(makeReq()); // happy
    mockVerifyCore.mockResolvedValueOnce(passedVerdict({ passed: false }));
    await releaseClientFromPendingSignatureHandler(makeReq()).catch(() => undefined); // failed verdict
    docResponses.set(`pending_signature_intents/${VALID_ID}`, { exists: false });
    await releaseClientFromPendingSignatureHandler(makeReq()).catch(() => undefined); // not-found intent

    const blob = loggerCalls.join(' ') + JSON.stringify(writeOps);
    expect(loggerCalls.length).toBeGreaterThan(0);
    expect(blob).not.toContain(REASONING_SENTINEL);
    expect(blob).not.toContain(FAKE_ANTHROPIC_KEY);
    expect(blob).not.toContain('sa-key');
  });
});
