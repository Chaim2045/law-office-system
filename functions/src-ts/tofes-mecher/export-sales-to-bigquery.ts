/**
 * exportSalesToBigQuery — Phase 2 H.1.c (Pattern D: analytical export)
 * ─────────────────────────────────────────────────────────────────────────────
 * Scheduled hourly CF that reads the tofes-mecher `sales_records` collection (via
 * the cross-project named app) and replaces the BigQuery mirror table
 * `law_office_analytics.sales_records` (MAIN project). The mirror is the
 * Pattern-D discovery source for the H.6 cutover (DLR §8.2.5 #6).
 *
 * ─── Credentials (two of them) ──────────────────────────────────────────────
 *  • READ  tofes-mecher Firestore → the cross-project SA key (defineSecret, the
 *    same TOFES_MECHER_SA_KEY the H.1.b read uses).
 *  • WRITE BigQuery in the MAIN project → the function's own runtime SA via ADC
 *    (no key). The runtime SA MUST hold roles/bigquery.dataEditor (dataset) +
 *    roles/bigquery.jobUser (project) — a Console prerequisite (Haim). Without
 *    it the load fails at the FIRST RUN (not deploy) with PERMISSION_DENIED.
 *
 * ─── Hardening (H.1.c devils-advocate STOP — all 3 🔴 closed) ────────────────
 *  🔴-1 ALL-OR-NOTHING READ: the entire `sales_records` collection is read in one
 *       `.get()`. If it throws, the run ABORTS and the BigQuery table is NOT
 *       touched — a partial read can never truncate-and-replace the good mirror
 *       with incomplete data (silent row loss).
 *  🔴-1b NEVER TRUNCATE TO EMPTY: WRITE_TRUNCATE runs ONLY when there is ≥1 mapped
 *       row. A read returning 0 docs, or a total mapping failure, ABORTS the load
 *       (the collection is known to hold data — H.1.a `sawAtLeastOneDoc:true`), so
 *       an anomaly can never wipe the mirror.
 *  🔴-2 RECONCILIATION: rowsRead / rowsMapped / rowsFailed are counted, returned,
 *       logged, and written to a run-level audit. Per-row map failures are
 *       dead-lettered (non-PII) — they are visible + countable, not silent.
 *  🔴-4 RUN-LEVEL AUDIT: every run writes a durable `TOFES_BQ_EXPORT` audit_log
 *       entry (sys actor, non-PII counts) on success AND failure, and THROWS on a
 *       hard failure so Cloud Scheduler records a failed execution (alertable) —
 *       not just a log line nobody reads.
 *
 * ─── PII discipline (G7, public repo) ───────────────────────────────────────
 *  The mirror holds PII (id_number/client_name/phone/email + 4 amounts), so the
 *  dataset is access-controlled by principal-scoped BQ IAM (Console). NO PII ever
 *  reaches logger.* or the dead-letter — only counts, errorCode, salesRecordId
 *  (the 20-char auto-id, a non-PII business id). The `raw_json` whole-doc column
 *  is OMITTED (security default-deny) — it would re-import address + smuggle
 *  future tofes fields into PII-at-rest unreviewed.
 */
import * as admin from 'firebase-admin';
import { onSchedule, type ScheduledEvent } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';

import {
  REGION,
  MAIN_PROJECT_ID,
  TOFES_MECHER_SA_KEY_SECRET,
  TOFES_SALES_COLLECTION,
  BIGQUERY_DATASET,
  BIGQUERY_SALES_TABLE
} from '../config';
import { getTofesMecherApp, TofesMecherCredentialError } from './app';
import { logCriticalAction } from '../audit-critical';
import * as logger from '../../shared/logger';

const TOFES_KEY = defineSecret(TOFES_MECHER_SA_KEY_SECRET);

/** Stable audit action + system actor (non-PII payload only). */
const AUDIT_ACTION = 'TOFES_BQ_EXPORT';
const SYS_ACTOR = 'sys:cron-export-sales-bq';

/** Dead-letter collection (MAIN project, CF-only — see firestore.rules). */
const DEADLETTER_COLLECTION = 'tofes_export_deadletter';

/**
 * Forensic-retention horizon for dead-letter docs (days). A Firestore TTL policy
 * auto-reaps each doc once its `expireAt` field is reached — see
 * docs/PHASE_2_FOUNDATIONS.md "Retention & TTL".
 *
 * Why the TTL targets `expireAt` and NOT `failedAt`: Firestore TTL deletes a doc
 * when the VALUE of the policy field is reached, and `failedAt` is a
 * `serverTimestamp()` set to ~now at write time — already in the past — so a policy
 * on it would purge every dead-letter doc almost immediately and destroy the
 * forensic window. `expireAt = failedAt + this many days` is the future instant the
 * policy fires on. 90d = a full quarter of diagnostic history (matches the quarterly
 * agent-usage routine), surviving holidays/court schedule before triage.
 */
const DEADLETTER_RETENTION_DAYS = 90;

/**
 * The BigQuery table schema — the SSOT for the 19 typed columns (the documented
 * H.0 schema MINUS the omitted `raw_json`). A drift-guard test pins this to the
 * documented column list. Order/types match docs/PHASE_2_FOUNDATIONS.md.
 */
export const BQ_SALES_SCHEMA: Array<{ name: string; type: string; mode: string }> = [
  { name: 'sales_record_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'id_number', type: 'STRING', mode: 'NULLABLE' },
  { name: 'client_name', type: 'STRING', mode: 'NULLABLE' },
  { name: 'phone', type: 'STRING', mode: 'NULLABLE' },
  { name: 'email', type: 'STRING', mode: 'NULLABLE' },
  { name: 'tofes_client_id', type: 'STRING', mode: 'NULLABLE' },
  { name: 'transaction_type', type: 'STRING', mode: 'NULLABLE' },
  { name: 'amount_before_vat', type: 'NUMERIC', mode: 'NULLABLE' },
  { name: 'vat_amount', type: 'NUMERIC', mode: 'NULLABLE' },
  { name: 'amount_with_vat', type: 'NUMERIC', mode: 'NULLABLE' },
  { name: 'amount', type: 'NUMERIC', mode: 'NULLABLE' },
  { name: 'payment_method', type: 'STRING', mode: 'NULLABLE' },
  { name: 'payments_count', type: 'INT64', mode: 'NULLABLE' },
  { name: 'months_count', type: 'INT64', mode: 'NULLABLE' },
  { name: 'attorney', type: 'STRING', mode: 'NULLABLE' },
  { name: 'branch', type: 'STRING', mode: 'NULLABLE' },
  { name: 'record_date', type: 'STRING', mode: 'NULLABLE' },
  { name: 'record_timestamp', type: 'TIMESTAMP', mode: 'NULLABLE' },
  { name: 'synced_at', type: 'TIMESTAMP', mode: 'REQUIRED' }
];

export interface ExportResult {
  ok: boolean;
  rowsRead: number;
  rowsMapped: number;
  rowsFailed: number;
}

/**
 * Minimal structural views of the @google-cloud/bigquery client — so the lazy
 * `await import(...)` result can be used WITHOUT a top-level type import (which
 * would defeat the lazy-import + trip the AST guard). Cast once at construction.
 */
interface BqLoadMetadata {
  sourceFormat: string;
  writeDisposition: string;
  schema: { fields: Array<{ name: string; type: string; mode: string }> };
}
interface BqTable {
  exists(): Promise<[boolean]>;
  createWriteStream(metadata: BqLoadMetadata): NodeJS.WritableStream;
}
interface BqDataset {
  table(id: string): BqTable;
  createTable(id: string, options: { schema: { fields: Array<{ name: string; type: string; mode: string }> } }): Promise<unknown>;
}
interface BqClient {
  dataset(id: string): BqDataset;
}

/** A single BQ row (a typed projection of one sales_record). */
interface BqSalesRow {
  sales_record_id: string;
  id_number: string | null;
  client_name: string | null;
  phone: string | null;
  email: string | null;
  tofes_client_id: string | null;
  transaction_type: string | null;
  // Currency NUMERIC columns are emitted as fixed-2dp DECIMAL strings (see
  // numStrOrNull) so the float-noise tail can never exceed NUMERIC's scale.
  amount_before_vat: string | null;
  vat_amount: string | null;
  amount_with_vat: string | null;
  amount: string | null;
  payment_method: string | null;
  payments_count: number | null;
  months_count: number | null;
  attorney: string | null;
  branch: string | null;
  record_date: string | null;
  record_timestamp: string | null;
  synced_at: string;
}

// ─── Coercion helpers (snapshot-never-re-derive; raw values, NO computation) ──

/** Absent/non-string → null. */
function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/**
 * Currency → NUMERIC coercion. Absent/non-finite → null (0 is a VALID amount →
 * "0.00", which must stay distinct from null). A finite number → a fixed 2-decimal
 * DECIMAL STRING (ILS agorot).
 *
 * Why a 2dp STRING and not the raw JS number: the BigQuery column is NUMERIC
 * (DECIMAL, max scale 9). tofes amounts arrive as JS floats that carry
 * multiplication noise — e.g. amountWithVat = 4249.69 is stored as
 * `4249.6900000000005` (13 fractional digits, a `base * 1.17` VAT artifact), which
 * exceeds NUMERIC's scale and makes the ENTIRE WRITE_TRUNCATE load fail
 * (maxBadRecords = 0 → one bad row aborts the whole mirror). `v.toFixed(2)` →
 * `"4249.69"` clamps to currency scale (the agora is the smallest real ILS unit)
 * and loads cleanly into NUMERIC. This is a representational normalization to the
 * column's currency semantics — NOT a business re-derivation: the sub-agora tail is
 * float artifact, never real precision. (Quoting NUMERIC as a string is also the
 * BigQuery-recommended form — it avoids float round-trips entirely.)
 *
 * Magnitude guard (defense-in-depth, mirrors the INT64 Number.isSafeInteger gate):
 * for |v| ≥ 1e15, `toFixed` would emit exponential notation ("1e+21") — itself an
 * INVALID NUMERIC token that would re-trigger the very load-abort this fixes. Real
 * ILS sale amounts are ≤ low millions (~7 integer digits), so an out-of-range value
 * is treated as unknown (null), NEVER a load-breaking string. 1e15 sits far below
 * both the exponential threshold (1e21) and NUMERIC's precision-38 ceiling.
 */
function numStrOrNull(v: unknown): string | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) >= 1e15) return null;
  return v.toFixed(2);
}

/**
 * tofes string-numeric (paymentsCount/monthsCount) → INT64 | null. The ONLY
 * coercion beyond Timestamp→ISO. Empty / non-integer string → null (NEVER 0 —
 * "blank" must not become "zero payments", which would fabricate data).
 */
function intStrOrNull(v: unknown): number | null {
  if (typeof v !== 'string' || !/^\d+$/.test(v.trim())) return null;
  const n = Number.parseInt(v.trim(), 10);
  return Number.isSafeInteger(n) ? n : null;
}

/** Firestore Timestamp → ISO 8601 string (the one transform). null if absent. */
function tsIsoOrNull(v: unknown): string | null {
  if (v && typeof (v as { toDate?: unknown }).toDate === 'function') {
    try {
      return (v as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Maps one tofes sales_record doc → a typed BQ row (allowlist projection; raw
 * values; NO raw_json; NO VAT math; NO fee-pick; NO date reformat). The only
 * representational transforms are the column-dictated ones: Timestamp→ISO,
 * string→INT64, and currency→2dp-DECIMAL-string (numStrOrNull — clamps source
 * float noise to NUMERIC's currency scale; see its docstring).
 * @throws if the doc id is missing (a row with no key cannot be written).
 */
export function mapDocToRow(
  id: string,
  data: Record<string, unknown>,
  syncedAtIso: string
): BqSalesRow {
  if (!id) throw new Error('missing_doc_id');
  return {
    sales_record_id: id,
    id_number: strOrNull(data.idNumber),
    client_name: strOrNull(data.clientName),
    phone: strOrNull(data.phone),
    email: strOrNull(data.email),
    tofes_client_id: strOrNull(data.clientId),
    transaction_type: strOrNull(data.transactionType),
    amount_before_vat: numStrOrNull(data.amountBeforeVat),
    vat_amount: numStrOrNull(data.vatAmount),
    amount_with_vat: numStrOrNull(data.amountWithVat),
    amount: numStrOrNull(data.amount),
    payment_method: strOrNull(data.paymentMethod),
    payments_count: intStrOrNull(data.paymentsCount),
    months_count: intStrOrNull(data.monthsCount),
    attorney: strOrNull(data.attorney),
    branch: strOrNull(data.branch),
    record_date: strOrNull(data.date),
    record_timestamp: tsIsoOrNull(data.timestamp),
    synced_at: syncedAtIso
  };
}

/** Best-effort run audit (never masks the export result; logs on its own failure). */
async function safeRunAudit(payload: Record<string, unknown>): Promise<void> {
  try {
    await logCriticalAction(AUDIT_ACTION, SYS_ACTOR, payload);
  } catch (err: unknown) {
    const error = err as { code?: string };
    logger.error('tofes_bq_export.audit_failed', { errorCode: error.code });
  }
}

/**
 * Non-PII dead-letter for a row that failed to map (salesRecordId + errorCode only,
 * plus the forensic timestamps). `expireAt` is the TTL target (see
 * DEADLETTER_RETENTION_DAYS) — a pure time value, no PII.
 */
async function deadLetter(salesRecordId: string, errorCode: string): Promise<void> {
  try {
    await admin.firestore().collection(DEADLETTER_COLLECTION).add({
      salesRecordId,
      errorCode,
      failedAt: admin.firestore.FieldValue.serverTimestamp(),
      // TTL target. serverTimestamp() is a server-resolved sentinel that can't be
      // arithmetic'd, so expireAt is a client-computed Timestamp. The Firestore TTL
      // policy is set on THIS field, never on failedAt (already in the past).
      expireAt: admin.firestore.Timestamp.fromMillis(
        Date.now() + DEADLETTER_RETENTION_DAYS * 86_400_000
      ),
      schemaVersion: 1
    });
  } catch (err: unknown) {
    const error = err as { code?: string };
    logger.error('tofes_bq_export.deadletter_failed', { salesRecordId, errorCode: error.code });
  }
}

/**
 * Internal handler — exported separately for direct unit testing (no scheduler
 * wrapping needed in tests). Returns the reconciliation result; THROWS on a hard
 * failure so Cloud Scheduler records a failed execution (alertable).
 */
export async function exportSalesToBigQueryHandler(): Promise<ExportResult> {
  const syncedAtIso = new Date().toISOString();

  // ─── (1) ALL-OR-NOTHING read of the whole collection (🔴-1) ───────────────
  let docs: Array<{ id: string; data: () => Record<string, unknown> }>;
  try {
    const app = getTofesMecherApp(TOFES_KEY.value());
    const snap = await app.firestore().collection(TOFES_SALES_COLLECTION).get();
    docs = snap.docs;
  } catch (err: unknown) {
    const name = err instanceof TofesMecherCredentialError ? err.name : 'read_failed';
    const code = (err as { code?: string }).code;
    logger.error('tofes_bq_export.read_aborted', { errorName: name, errorCode: code });
    await safeRunAudit({ ok: false, phase: 'read', errorName: name });
    // Throw → Cloud Scheduler marks the run failed; the BQ table is untouched.
    throw new Error('tofes_bq_export read aborted');
  }
  const rowsRead = docs.length;

  // ─── (2) Per-row map; failures are dead-lettered + counted (🔴-2) ─────────
  const rows: BqSalesRow[] = [];
  let rowsFailed = 0;
  for (const doc of docs) {
    try {
      rows.push(mapDocToRow(doc.id, doc.data() ?? {}, syncedAtIso));
    } catch (err: unknown) {
      rowsFailed += 1;
      const code = (err as { message?: string }).message ?? 'map_error';
      logger.error('tofes_bq_export.row_failed', { salesRecordId: doc.id, errorCode: code });
      await deadLetter(doc.id, code);
    }
  }
  const rowsMapped = rows.length;

  // ─── (3) NEVER truncate to empty (🔴-1b) — abort the load on a zero/total-fail
  // anomaly. The collection is known to hold data (H.1.a sawAtLeastOneDoc:true),
  // so 0 mapped rows is an anomaly, not a legitimate empty mirror.
  if (rowsMapped === 0) {
    logger.error('tofes_bq_export.no_rows_aborted', { rowsRead, rowsFailed });
    await safeRunAudit({ ok: false, phase: 'guard', rowsRead, rowsMapped, rowsFailed });
    throw new Error('tofes_bq_export aborted: 0 mapped rows (table left intact)');
  }

  // ─── (4) Lazy-import BigQuery + ensure table + WRITE_TRUNCATE load ─────────
  try {
    // Lazy-import: @google-cloud/bigquery is heavy and index.js fans out to ~67
    // CFs — a top-level import would bloat every cold start. Load it only here.
    const { BigQuery } = await import('@google-cloud/bigquery');
    const bq = new BigQuery({ projectId: MAIN_PROJECT_ID }) as unknown as BqClient;
    const dataset = bq.dataset(BIGQUERY_DATASET);
    const table = dataset.table(BIGQUERY_SALES_TABLE);

    const [exists] = await table.exists();
    if (!exists) {
      await dataset.createTable(BIGQUERY_SALES_TABLE, { schema: { fields: BQ_SALES_SCHEMA } });
    }

    // WRITE_TRUNCATE load from in-memory NDJSON — atomic table replace (the old
    // contents survive on failure; the new contents appear only on success).
    await loadTruncate(table, rows);
  } catch (err: unknown) {
    const code = (err as { code?: string }).code ?? 'bq_load_failed';
    logger.error('tofes_bq_export.load_failed', { errorCode: code, rowsRead, rowsMapped, rowsFailed });
    await safeRunAudit({ ok: false, phase: 'load', errorCode: code, rowsRead, rowsMapped, rowsFailed });
    throw new Error('tofes_bq_export load failed');
  }

  // ─── (5) Success: reconciliation log + durable run audit (🔴-2/🔴-4) ───────
  logger.info('tofes_bq_export.ok', { rowsRead, rowsMapped, rowsFailed });
  await safeRunAudit({ ok: true, rowsRead, rowsMapped, rowsFailed });
  return { ok: true, rowsRead, rowsMapped, rowsFailed };
}

/**
 * Loads `rows` into the table with WRITE_TRUNCATE (full replace) via an in-memory
 * NDJSON write stream. Resolves on the load job's `complete`/`finish`; rejects on
 * `error`. Isolated so the test can mock `table.createWriteStream`.
 */
async function loadTruncate(
  table: BqTable,
  rows: BqSalesRow[]
): Promise<void> {
  const { Readable } = await import('stream');
  const ndjson = rows.map((r) => JSON.stringify(r)).join('\n');
  await new Promise<void>((resolve, reject) => {
    const stream = table.createWriteStream({
      sourceFormat: 'NEWLINE_DELIMITED_JSON',
      writeDisposition: 'WRITE_TRUNCATE',
      schema: { fields: BQ_SALES_SCHEMA }
    });
    stream.on('error', reject);
    stream.on('finish', resolve);
    Readable.from([ndjson]).pipe(stream);
  });
}

// ─── v2 Scheduled Cloud Function wrapper (hourly) ───────────────────────────
export const exportSalesToBigQuery = onSchedule(
  {
    schedule: '0 * * * *',
    timeZone: 'Asia/Jerusalem',
    region: REGION,
    secrets: [TOFES_KEY]
  },
  async (_event: ScheduledEvent): Promise<void> => {
    await exportSalesToBigQueryHandler();
  }
);
