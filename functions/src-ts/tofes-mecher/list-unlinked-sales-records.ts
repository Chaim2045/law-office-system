/**
 * listUnlinkedSalesRecords — Phase 2 H.6 (Pending Client Creation listing)
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin-gated v2 callable that reads ALL sales_records from the tofes-mecher
 * project (cross-project SA key) and cross-references the CF-only
 * `sales_record_links` collection in the MAIN project to return only the
 * UNLINKED records — sales that do NOT yet have a corresponding law-office
 * client.
 *
 * ─── Dual-project read (new pattern) ────────────────────────────────────────
 * This is the first CF that reads from BOTH projects in a single call:
 *   1. tofes-mecher `sales_records` via the named app (SA key + defineSecret)
 *   2. main-project `sales_record_links` via `admin.firestore()` (ADC)
 * The two reads are independent (no cross-project transaction needed) — a
 * small race window exists where a link is created between the two reads, but
 * `createClientFromSalesRecord` is idempotent, so a stale "unlinked" entry
 * simply results in a no-op {created:false} on approve.
 *
 * ─── Design contract (H.6 checkpoint, Haim-approved 2026-07-02) ────────────
 *  1. v2 `onCall` with `{ secrets: [TOFES_KEY] }`.
 *  2. Role-only admin gate (same as validateSalesRecordExists).
 *  3. No input parameters — returns ALL unlinked records (current scale: ~161
 *     total sales_records; hard cap at 500 for safety).
 *  4. Uses the SSOT `projectSalesRecord` for field-minimized 9-field snapshot.
 *  5. ONE non-PII audit entry per call (action: LIST_UNLINKED_SALES_RECORDS,
 *     payload: {totalSales, linkedCount, unlinkedCount}). NOT per-record —
 *     this is a listing (discovery), not a commit-read (that's H.1.b).
 *  6. NO PII in logger output — only counts, uid, error codes.
 *  7. Hard cap: if sales_records exceeds 500 docs, returns the first 500
 *     unlinked + a `capped: true` flag.
 */
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';

import { REGION, TOFES_MECHER_SA_KEY_SECRET, TOFES_SALES_COLLECTION } from '../config';
import { getTofesMecherApp, TofesMecherCredentialError } from './app';
import { logCriticalAction } from '../audit-critical';
import { projectSalesRecord, type SalesRecordSnapshot } from './validate-sales-record';
import * as logger from '../../shared/logger';

const TOFES_KEY = defineSecret(TOFES_MECHER_SA_KEY_SECRET);

const AUDIT_ACTION = 'LIST_UNLINKED_SALES_RECORDS';
const SALES_RECORD_LINKS_COLLECTION = 'sales_record_links';
const HARD_CAP = 500;

export interface ListUnlinkedSalesRecordsResponse {
  unlinkedRecords: SalesRecordSnapshot[];
  totalSales: number;
  linkedCount: number;
  unlinkedCount: number;
  capped: boolean;
}

/**
 * Internal handler — exported for unit testing.
 */
export async function listUnlinkedSalesRecordsHandler(
  request: CallableRequest<unknown>
): Promise<ListUnlinkedSalesRecordsResponse> {
  // ─── (1) Auth gate (role-only admin) ──────────────────────────────────────
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'נדרשת התחברות למערכת.');
  }
  const claims = (request.auth.token ?? {}) as { role?: string };
  if (claims.role !== 'admin') {
    throw new HttpsError(
      'permission-denied',
      'רק מנהל מערכת רשאי לצפות ברשומות מכר ממתינות.'
    );
  }
  const callerUid = request.auth.uid;

  // ─── (2) Init the tofes-mecher named app ──────────────────────────────────
  let tofesApp;
  try {
    tofesApp = getTofesMecherApp(TOFES_KEY.value());
  } catch (err: unknown) {
    const name = err instanceof TofesMecherCredentialError
      ? err.name
      : 'unknown_init_error';
    logger.error('tofes_mecher.list_unlinked.init_failed', {
      actor: { uid: callerUid },
      errorName: name
    });
    throw new HttpsError(
      'internal',
      'שגיאה באתחול החיבור לטופס המכר. ודא שהמפתח הוגדר כראוי ונסה שוב, או פנה לתמיכה.'
    );
  }

  // ─── (3) Read ALL sales_records from tofes-mecher ─────────────────────────
  let allSalesDocs;
  try {
    const snap = await tofesApp.firestore()
      .collection(TOFES_SALES_COLLECTION)
      .get();
    allSalesDocs = snap.docs;
  } catch (err: unknown) {
    const error = err as { code?: string };
    logger.error('tofes_mecher.list_unlinked.read_sales_failed', {
      actor: { uid: callerUid },
      errorCode: error.code
    });
    throw new HttpsError(
      'unavailable',
      'לא ניתן לקרוא את רשומות המכר כעת. נסה שוב מאוחר יותר.'
    );
  }

  // ─── (4) Read ALL sales_record_links from MAIN project ────────────────────
  let linkedIds: Set<string>;
  try {
    const linksSnap = await admin.firestore()
      .collection(SALES_RECORD_LINKS_COLLECTION)
      .select()  // id-only — no field data needed, saves bandwidth
      .get();
    linkedIds = new Set(linksSnap.docs.map(d => d.id));
  } catch (err: unknown) {
    const error = err as { code?: string };
    logger.error('tofes_mecher.list_unlinked.read_links_failed', {
      actor: { uid: callerUid },
      errorCode: error.code
    });
    throw new HttpsError(
      'unavailable',
      'לא ניתן לקרוא את הקישורים הקיימים כעת. נסה שוב מאוחר יותר.'
    );
  }

  // ─── (5) Compute unlinked set (difference) ────────────────────────────────
  const totalSales = allSalesDocs.length;
  const unlinkedRecords: SalesRecordSnapshot[] = [];
  let capped = false;

  for (const doc of allSalesDocs) {
    if (linkedIds.has(doc.id)) continue;
    if (unlinkedRecords.length >= HARD_CAP) {
      capped = true;
      break;
    }
    unlinkedRecords.push(projectSalesRecord(doc.id, doc.data() ?? {}));
  }

  const linkedCount = linkedIds.size;
  const unlinkedCount = unlinkedRecords.length;

  // ─── (6) Non-PII audit (one entry per listing call) ───────────────────────
  try {
    await logCriticalAction(AUDIT_ACTION, callerUid, {
      totalSales,
      linkedCount,
      unlinkedCount,
      capped
    });
  } catch {
    throw new HttpsError(
      'internal',
      'לא ניתן לתעד את הגישה לרשומות המכר כעת. אנא נסה שוב או פנה לתמיכה.'
    );
  }

  // ─── (7) Success log (non-PII) ────────────────────────────────────────────
  logger.info('tofes_mecher.list_unlinked.success', {
    actor: { uid: callerUid },
    totalSales,
    linkedCount,
    unlinkedCount,
    capped
  });

  return { unlinkedRecords, totalSales, linkedCount, unlinkedCount, capped };
}

// ─── v2 Cloud Function wrapper ──────────────────────────────────────────────
export const listUnlinkedSalesRecords =
  onCall<unknown, Promise<ListUnlinkedSalesRecordsResponse>>(
    { region: REGION, secrets: [TOFES_KEY] },
    listUnlinkedSalesRecordsHandler
  );
