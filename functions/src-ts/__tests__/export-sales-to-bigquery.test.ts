/**
 * exportSalesToBigQuery — Phase 2 H.1.c tests
 * ─────────────────────────────────────────────────────────────────────────────
 * (a) Static AST guards — never log PII, never raw_json, lazy-import bigquery,
 *     WRITE_TRUNCATE, schema drift vs the documented columns.
 * (b) mapDocToRow pure-function coercions (string→int, 0-stays-0, Timestamp→ISO).
 * (c) Runtime (mocked admin + scheduler + @google-cloud/bigquery): happy path,
 *     all-or-nothing read abort, never-truncate-to-empty, per-row dead-letter +
 *     reconciliation, load failure, run-level audit, no-PII-in-logs scan.
 *
 * NO real cross-project read, NO real BigQuery — every SDK boundary is mocked.
 */
import * as fs from 'fs';
import * as path from 'path';
import { PassThrough, Writable } from 'stream';

// ─── Mocks (before importing the handler) ───────────────────────────────────
const mockSalesGet = jest.fn();        // named-app: collection('sales_records').get()
const mockDefaultAdd = jest.fn();      // default app: collection(X).add() (audit + deadletter)
const mockInitializeApp = jest.fn();
const mockAppLookup = jest.fn();
const mockCert = jest.fn();

jest.mock('firebase-admin', () => {
  const namedFirestore = () => ({ collection: () => ({ get: mockSalesGet }) });
  const defaultFirestore = () => ({ collection: () => ({ add: mockDefaultAdd, doc: () => ({}) }) });
  const firestoreFn = (...args: unknown[]) => defaultFirestore(...(args as []));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (firestoreFn as any).FieldValue = { serverTimestamp: () => 'ts-sentinel' };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (firestoreFn as any).Timestamp = { fromMillis: (ms: number) => ({ __ttlMs: ms }) };
  return {
    app: (name: string) => mockAppLookup(name),
    initializeApp: (...args: unknown[]) => { mockInitializeApp(...args); return { firestore: namedFirestore }; },
    credential: { cert: (...args: unknown[]) => mockCert(...args) },
    firestore: firestoreFn
  };
});

jest.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: (_config: unknown, handler: unknown) => handler
}));

jest.mock('firebase-functions/params', () => ({
  defineSecret: (name: string) => ({ name, value: () => '{"fake":"sa-key"}' })
}));

// BigQuery client mock — capture createWriteStream metadata + loaded NDJSON.
const mockTableExists = jest.fn();
const mockCreateTable = jest.fn();
const writeStreamMeta: Array<Record<string, unknown>> = [];
const loadedNdjson: string[] = [];
let nextStreamErrors = false;

function makeStream(): NodeJS.WritableStream {
  if (nextStreamErrors) {
    const w = new Writable({ write(_c, _e, cb) { cb(); } });
    process.nextTick(() => w.emit('error', { code: 'PERMISSION_DENIED' }));
    return w;
  }
  const pt = new PassThrough();
  const chunks: Buffer[] = [];
  pt.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
  pt.on('finish', () => loadedNdjson.push(Buffer.concat(chunks).toString('utf8')));
  return pt;
}

jest.mock('@google-cloud/bigquery', () => ({
  BigQuery: jest.fn().mockImplementation(() => ({
    dataset: () => ({
      table: () => ({
        exists: mockTableExists,
        createWriteStream: (meta: Record<string, unknown>) => { writeStreamMeta.push(meta); return makeStream(); }
      }),
      createTable: mockCreateTable
    })
  }))
}));

const loggerCalls: string[] = [];
jest.mock('../../shared/logger', () => ({
  info: (...a: unknown[]) => { loggerCalls.push(JSON.stringify(a)); },
  warn: (...a: unknown[]) => { loggerCalls.push(JSON.stringify(a)); },
  error: (...a: unknown[]) => { loggerCalls.push(JSON.stringify(a)); }
}));

import { exportSalesToBigQueryHandler, mapDocToRow, BQ_SALES_SCHEMA } from '../tofes-mecher/export-sales-to-bigquery';
import { __resetTofesMecherAppForTests } from '../tofes-mecher/app';

const PII = {
  idNumber: 'IDNUM-SENTINEL', clientName: 'NAME-SENTINEL', phone: 'PHONE-SENTINEL',
  email: 'EMAIL-SENTINEL', address: 'ADDR-SENTINEL'
};

function saleDoc(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    data: () => ({
      ...PII,
      clientId: 'TOFES-INTERNAL',
      transactionType: 'ייעוץ',
      amountBeforeVat: 1000, vatAmount: 170, amountWithVat: 1170, amount: 1170,
      paymentMethod: 'אשראי', paymentsCount: '3', monthsCount: '12',
      attorney: 'עו"ד', branch: 'ראשי', date: '2026-01-02',
      timestamp: { toDate: () => new Date('2026-01-02T03:04:05.000Z') },
      ...extra
    })
  };
}

beforeEach(() => {
  __resetTofesMecherAppForTests();
  mockSalesGet.mockReset().mockResolvedValue({ docs: [saleDoc('AbCdEf0123456789wxyz')] });
  mockDefaultAdd.mockReset().mockResolvedValue({ id: 'doc-id' });
  mockInitializeApp.mockReset();
  mockAppLookup.mockReset().mockImplementation(() => { throw new Error('app/no-app'); });
  mockCert.mockReset().mockReturnValue({ __cred: true });
  mockTableExists.mockReset().mockResolvedValue([true]);
  mockCreateTable.mockReset().mockResolvedValue([{}]);
  writeStreamMeta.length = 0;
  loadedNdjson.length = 0;
  loggerCalls.length = 0;
  nextStreamErrors = false;
});

// ════════════════════════════════════════════════════════════════════════════
// (a) Static AST invariants
// ════════════════════════════════════════════════════════════════════════════
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

describe('export-sales-to-bigquery — static AST invariants', () => {
  let code: string;
  beforeAll(() => {
    code = stripComments(fs.readFileSync(path.resolve(__dirname, '../tofes-mecher/export-sales-to-bigquery.ts'), 'utf8'));
  });

  it('lazy-imports @google-cloud/bigquery (no top-level import)', () => {
    expect(code).not.toMatch(/^import[^\n]*@google-cloud\/bigquery/m);
    expect(code).toMatch(/await import\('@google-cloud\/bigquery'\)/);
  });

  it('uses WRITE_TRUNCATE (atomic full replace)', () => {
    expect(code).toMatch(/writeDisposition:\s*'WRITE_TRUNCATE'/);
  });

  it('never emits a raw_json / whole-doc column', () => {
    expect(code).not.toMatch(/raw_json/);
    expect(code).not.toMatch(/JSON\.stringify\(\s*data\s*\)/);
  });

  it('NEVER passes PII to any logger.* call', () => {
    const forbidden = ['idNumber', 'clientName', 'amountBeforeVat', 'vatAmount', 'amount', 'phone', 'email', 'address'];
    for (const ident of forbidden) {
      expect(code).not.toMatch(new RegExp(`logger\\.\\w+\\([^)]*\\b${ident}\\b`));
    }
  });

  it('writes a run-level audit via logCriticalAction with a sys actor', () => {
    expect(code).toContain('logCriticalAction');
    expect(code).toMatch(/sys:cron-export-sales-bq/);
  });

  it('dead-letter write references NO PII identifier (payload locked)', () => {
    // The deadLetter() Firestore write must carry only {salesRecordId, errorCode,
    // failedAt, expireAt, schemaVersion}. Lock the PII-free property so a future edit
    // that adds e.g. `idNumber: data.idNumber` to the dead-letter doc fails HERE — not
    // silently at rest. (security-access-expert condition — enforced, not emergent;
    // extends the logger.* no-PII guard above to the Firestore write payload.)
    const fn = code.match(/async function deadLetter\([\s\S]*?\n\}/);
    expect(fn).not.toBeNull();
    const body = fn ? fn[0] : '';
    const forbidden = ['idNumber', 'clientName', 'amountBeforeVat', 'vatAmount', 'amountWithVat', 'amount', 'phone', 'email', 'address', 'clientId'];
    for (const ident of forbidden) {
      expect(body).not.toMatch(new RegExp(`\\b${ident}\\b`));
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (b) Schema drift-guard — pins the 19 documented columns, no raw_json
// ════════════════════════════════════════════════════════════════════════════
describe('export-sales-to-bigquery — schema drift guard', () => {
  it('has exactly the 19 documented columns in order', () => {
    expect(BQ_SALES_SCHEMA.map((c) => c.name)).toEqual([
      'sales_record_id', 'id_number', 'client_name', 'phone', 'email', 'tofes_client_id',
      'transaction_type', 'amount_before_vat', 'vat_amount', 'amount_with_vat', 'amount',
      'payment_method', 'payments_count', 'months_count', 'attorney', 'branch',
      'record_date', 'record_timestamp', 'synced_at'
    ]);
  });

  it('omits raw_json; pins REQUIRED on the two always-present columns', () => {
    expect(BQ_SALES_SCHEMA.find((c) => c.name === 'raw_json')).toBeUndefined();
    const required = BQ_SALES_SCHEMA.filter((c) => c.mode === 'REQUIRED').map((c) => c.name);
    expect(required).toEqual(['sales_record_id', 'synced_at']);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (c) mapDocToRow — coercions (snapshot-never-re-derive)
// ════════════════════════════════════════════════════════════════════════════
describe('mapDocToRow', () => {
  const ISO = '2026-06-09T00:00:00.000Z';

  it('maps a full doc to the typed row (Timestamp→ISO, string→int)', () => {
    const row = mapDocToRow('AbCdEf0123456789wxyz', saleDoc('x').data(), ISO);
    expect(row).toMatchObject({
      sales_record_id: 'AbCdEf0123456789wxyz',
      id_number: 'IDNUM-SENTINEL', client_name: 'NAME-SENTINEL',
      amount_before_vat: '1000.00', vat_amount: '170.00', amount_with_vat: '1170.00',
      payments_count: 3, months_count: 12,
      record_timestamp: '2026-01-02T03:04:05.000Z', record_date: '2026-01-02',
      synced_at: ISO
    });
  });

  it('empty/non-numeric string-int → null (never 0); 0 amount → "0.00" (distinct from null)', () => {
    const row = mapDocToRow('id', { paymentsCount: '', monthsCount: 'abc', amount: 0, amountBeforeVat: undefined }, ISO);
    expect(row.payments_count).toBeNull();
    expect(row.months_count).toBeNull();
    expect(row.amount).toBe('0.00');     // valid zero as a NUMERIC string, NOT null
    expect(row.amount_before_vat).toBeNull();
  });

  it('clamps source float-noise to a NUMERIC-safe 2dp string (the H.1.c load-failure fix)', () => {
    // tofes stores 4249.69 as the float 4249.6900000000005 (13 fractional digits) —
    // BigQuery NUMERIC (scale 9) rejected it, failing the WHOLE load. toFixed(2) fixes it.
    const row = mapDocToRow('id', {
      amountWithVat: 4249.6900000000005,
      amountBeforeVat: 3632.2,
      vatAmount: 617.4899999999999,
      amount: -100        // negatives are valid currency
    }, ISO);
    expect(row.amount_with_vat).toBe('4249.69');
    expect(row.amount_before_vat).toBe('3632.20');
    expect(row.vat_amount).toBe('617.49');
    expect(row.amount).toBe('-100.00');
    // every amount column must be a string with exactly 2 decimals (NUMERIC scale ≤ 9)
    for (const v of [row.amount_with_vat, row.amount_before_vat, row.vat_amount, row.amount]) {
      expect(typeof v).toBe('string');
      expect(v).toMatch(/^-?\d+\.\d{2}$/);
    }
  });

  it('non-number / non-finite / out-of-range amounts → null (never a bogus 0 or exponential string)', () => {
    const row = mapDocToRow('id', {
      amount: '1170',              // a string is not a number → null
      amountBeforeVat: NaN,        // non-finite → null
      vatAmount: Infinity,         // non-finite → null
      amountWithVat: 1e21          // beyond the magnitude guard → null (toFixed would emit "1e+21")
    }, ISO);
    expect(row.amount).toBeNull();
    expect(row.amount_before_vat).toBeNull();
    expect(row.vat_amount).toBeNull();
    expect(row.amount_with_vat).toBeNull();
  });

  it('absent fields → null; throws on missing doc id', () => {
    const row = mapDocToRow('id', {}, ISO);
    expect(row.client_name).toBeNull();
    expect(row.record_timestamp).toBeNull();
    expect(() => mapDocToRow('', {}, ISO)).toThrow();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (d) Happy path + table creation
// ════════════════════════════════════════════════════════════════════════════
describe('exportSalesToBigQueryHandler — happy path', () => {
  it('reads, maps, WRITE_TRUNCATE-loads, returns reconciliation counts', async () => {
    mockSalesGet.mockResolvedValueOnce({ docs: [saleDoc('id1'.padEnd(20, 'a')), saleDoc('id2'.padEnd(20, 'b'))] });
    const res = await exportSalesToBigQueryHandler();
    expect(res).toEqual({ ok: true, rowsRead: 2, rowsMapped: 2, rowsFailed: 0 });
    expect(writeStreamMeta[0]).toMatchObject({ writeDisposition: 'WRITE_TRUNCATE', sourceFormat: 'NEWLINE_DELIMITED_JSON' });
    expect(loadedNdjson[0].split('\n')).toHaveLength(2);
  });

  it('does not create the table when it already exists', async () => {
    mockTableExists.mockResolvedValueOnce([true]);
    await exportSalesToBigQueryHandler();
    expect(mockCreateTable).not.toHaveBeenCalled();
  });

  it('creates the table with the schema when it does not exist', async () => {
    mockTableExists.mockResolvedValueOnce([false]);
    await exportSalesToBigQueryHandler();
    expect(mockCreateTable).toHaveBeenCalledTimes(1);
    expect(mockCreateTable.mock.calls[0][1]).toEqual({ schema: { fields: BQ_SALES_SCHEMA } });
  });

  it('writes a success run-audit (TOFES_BQ_EXPORT, non-PII counts)', async () => {
    await exportSalesToBigQueryHandler();
    const audit = mockDefaultAdd.mock.calls.map((c) => c[0]).find((d) => d.action === 'TOFES_BQ_EXPORT');
    expect(audit).toBeDefined();
    expect(audit.userId).toBe('sys:cron-export-sales-bq');
    expect(audit.details).toMatchObject({ ok: true, rowsRead: 1, rowsMapped: 1, rowsFailed: 0 });
    for (const v of Object.values(PII)) expect(JSON.stringify(audit)).not.toContain(v);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (e) All-or-nothing read abort (🔴-1)
// ════════════════════════════════════════════════════════════════════════════
describe('exportSalesToBigQueryHandler — all-or-nothing read', () => {
  it('THROWS and never touches BigQuery when the cross-project read fails', async () => {
    mockSalesGet.mockRejectedValueOnce({ code: 'unavailable' });
    await expect(exportSalesToBigQueryHandler()).rejects.toThrow();
    expect(writeStreamMeta).toHaveLength(0);   // no load → table untouched
    expect(mockCreateTable).not.toHaveBeenCalled();
    const audit = mockDefaultAdd.mock.calls.map((c) => c[0]).find((d) => d.action === 'TOFES_BQ_EXPORT');
    expect(audit.details).toMatchObject({ ok: false, phase: 'read' });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (f) Never truncate to empty (🔴-1b)
// ════════════════════════════════════════════════════════════════════════════
describe('exportSalesToBigQueryHandler — never truncate to empty', () => {
  it('THROWS without loading when 0 rows mapped (read returned 0 docs)', async () => {
    mockSalesGet.mockResolvedValueOnce({ docs: [] });
    await expect(exportSalesToBigQueryHandler()).rejects.toThrow();
    expect(writeStreamMeta).toHaveLength(0);   // table NOT wiped to empty
    const audit = mockDefaultAdd.mock.calls.map((c) => c[0]).find((d) => d.action === 'TOFES_BQ_EXPORT');
    expect(audit.details).toMatchObject({ ok: false, phase: 'guard' });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (g) Per-row dead-letter + reconciliation (🔴-2)
// ════════════════════════════════════════════════════════════════════════════
describe('exportSalesToBigQueryHandler — dead-letter + reconciliation', () => {
  it('dead-letters a bad row (non-PII), still loads the good rows, counts failures', async () => {
    // one good doc + one with an empty id (mapDocToRow throws → dead-letter)
    mockSalesGet.mockResolvedValueOnce({ docs: [saleDoc('good'.padEnd(20, 'g')), saleDoc('')] });
    const res = await exportSalesToBigQueryHandler();
    expect(res).toEqual({ ok: true, rowsRead: 2, rowsMapped: 1, rowsFailed: 1 });
    // the good row was loaded
    expect(loadedNdjson[0].split('\n')).toHaveLength(1);
    // a dead-letter doc was written with NO PII
    const dl = mockDefaultAdd.mock.calls.map((c) => c[0]).find((d) => 'salesRecordId' in d && !('action' in d));
    expect(dl).toBeDefined();
    expect(dl.errorCode).toBeDefined();
    // TTL target present + strictly in the future — the policy is on expireAt, NOT the
    // already-past failedAt. Pins the "never TTL failedAt" invariant (failedAt stays
    // the 'ts-sentinel' string, so the two are trivially distinguishable in-test).
    expect(dl.expireAt).toBeDefined();
    expect(dl.expireAt.__ttlMs).toBeGreaterThan(Date.now());
    expect(dl.failedAt).toBe('ts-sentinel');
    for (const v of Object.values(PII)) expect(JSON.stringify(dl)).not.toContain(v);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (h) Load failure → THROWS + failure audit (🔴-4)
// ════════════════════════════════════════════════════════════════════════════
describe('exportSalesToBigQueryHandler — load failure', () => {
  it('THROWS and audits failure when the BQ write stream errors', async () => {
    nextStreamErrors = true;
    await expect(exportSalesToBigQueryHandler()).rejects.toThrow();
    const audit = mockDefaultAdd.mock.calls.map((c) => c[0]).find((d) => d.action === 'TOFES_BQ_EXPORT');
    expect(audit.details).toMatchObject({ ok: false, phase: 'load' });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (i) Runtime no-PII-in-logs scan
// ════════════════════════════════════════════════════════════════════════════
describe('exportSalesToBigQueryHandler — no PII in logs (runtime)', () => {
  it('no PII value reaches any logger.* call across success + failure paths', async () => {
    await exportSalesToBigQueryHandler();                               // success (PII in docs)
    mockSalesGet.mockResolvedValueOnce({ docs: [saleDoc('bad'), saleDoc('')] }); // a dead-letter
    await exportSalesToBigQueryHandler();
    nextStreamErrors = true;
    await exportSalesToBigQueryHandler().catch(() => undefined);        // load fail
    const blob = loggerCalls.join(' ');
    expect(loggerCalls.length).toBeGreaterThan(0);
    for (const v of Object.values(PII)) expect(blob).not.toContain(v);
    expect(blob).not.toContain('sa-key');
  });
});
