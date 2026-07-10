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
 *     payload: {totalSales, linkedCount, pendingCount, unlinkedCount}). NOT
 *     per-record — this is a listing (discovery), not a commit-read (H.1.b).
 *  6. NO PII in logger output — only counts, uid, error codes.
 *  7. Hard cap: if sales_records exceeds 500 docs, returns the first 500
 *     unlinked + a `capped: true` flag.
 *
 * ─── H.6.c-2: pending-signature intents also exclude ────────────────────────
 * c-1's `createClientFromSalesRecord` no longer writes `sales_record_links` —
 * it writes a CF-only idempotency marker to `pending_signature_intents/{salesRecordId}`
 * instead (the client it creates starts in status `pending_signature`, not yet
 * a fully-signed active case). A sale with a pending-signature intent has
 * ALREADY been acted on (a placeholder client exists for it) even though no
 * `sales_record_links` doc was written for it — so without this second
 * exclusion set, that sale would incorrectly re-appear as "unlinked" every
 * time this lister runs. Both `sales_record_links` and `pending_signature_intents`
 * are keyed by `salesRecordId` (id-only reads), so a plain Set union of the two
 * id sets is an exact (not approximate) exclusion — no false positives/negatives.
 * The two counts are kept SEPARATE in the audit/log/response (`linkedCount` vs.
 * `pendingCount`) rather than summed, so "already linked" and "pending
 * signature" stay distinguishable signals for whoever reads the run summary.
 */
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';

import { REGION, TOFES_MECHER_SA_KEY_SECRET, TOFES_SALES_COLLECTION } from '../config';
import { getTofesMecherReader, TofesMecherCredentialError } from './app';
import { logCriticalAction } from '../audit-critical';
import { projectSalesRecord, type SalesRecordSnapshot } from './validate-sales-record';
import * as logger from '../../shared/logger';

const TOFES_KEY = defineSecret(TOFES_MECHER_SA_KEY_SECRET);

const AUDIT_ACTION = 'LIST_UNLINKED_SALES_RECORDS';
const SALES_RECORD_LINKS_COLLECTION = 'sales_record_links';
// H.6.c-2: keep in sync with cutover/create-client-from-sales-record.ts's
// PENDING_SIGNATURE_INTENTS_COLLECTION (not imported directly — that module
// does not export the constant, and duplicating a literal collection-name
// string is the established pattern in this file for SALES_RECORD_LINKS_COLLECTION).
const PENDING_SIGNATURE_INTENTS_COLLECTION = 'pending_signature_intents';
const HARD_CAP = 500;

export interface ListUnlinkedSalesRecordsResponse {
  unlinkedRecords: SalesRecordSnapshot[];
  totalSales: number;
  linkedCount: number;
  pendingCount: number;
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

  // ─── (2) Init the tofes-mecher read-only reader ───────────────────────────
  let tofesReader;
  try {
    tofesReader = getTofesMecherReader(TOFES_KEY.value());
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
    const snap = await tofesReader.readCollection(TOFES_SALES_COLLECTION);
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

  // ─── (4b) Read ALL pending_signature_intents from MAIN project (H.6.c-2) ──
  // c-1 writes this idempotency marker INSTEAD OF sales_record_links for a
  // sale it already turned into a pending-signature client — so a sale with a
  // pending intent must be excluded here too, or it would incorrectly
  // re-appear as "unlinked" on every listing.
  let pendingIds: Set<string>;
  try {
    const pendingSnap = await admin.firestore()
      .collection(PENDING_SIGNATURE_INTENTS_COLLECTION)
      .select()  // id-only — no field data needed, saves bandwidth
      .get();
    pendingIds = new Set(pendingSnap.docs.map(d => d.id));
  } catch (err: unknown) {
    const error = err as { code?: string };
    logger.error('tofes_mecher.list_unlinked.read_pending_failed', {
      actor: { uid: callerUid },
      errorCode: error.code
    });
    throw new HttpsError(
      'unavailable',
      'לא ניתן לקרוא את רשומות ההמתנה לחתימה כעת. נסה שוב מאוחר יותר.'
    );
  }

  // ─── (5) Compute unlinked set (difference against the UNION of both sets) ─
  const totalSales = allSalesDocs.length;
  const excludedIds = new Set<string>([...linkedIds, ...pendingIds]);
  const unlinkedRecords: SalesRecordSnapshot[] = [];
  let capped = false;

  for (const doc of allSalesDocs) {
    if (excludedIds.has(doc.id)) continue;
    if (unlinkedRecords.length >= HARD_CAP) {
      capped = true;
      break;
    }
    unlinkedRecords.push(projectSalesRecord(doc.id, doc.data() ?? {}));
  }

  const linkedCount = linkedIds.size;
  const pendingCount = pendingIds.size;
  const unlinkedCount = unlinkedRecords.length;

  // ─── (6) Non-PII audit (one entry per listing call) ───────────────────────
  try {
    await logCriticalAction(AUDIT_ACTION, callerUid, {
      totalSales,
      linkedCount,
      pendingCount,
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
    pendingCount,
    unlinkedCount,
    capped
  });

  return { unlinkedRecords, totalSales, linkedCount, pendingCount, unlinkedCount, capped };
}

// ─── v2 Cloud Function wrapper ──────────────────────────────────────────────
export const listUnlinkedSalesRecords =
  onCall<unknown, Promise<ListUnlinkedSalesRecordsResponse>>(
    { region: REGION, secrets: [TOFES_KEY] },
    listUnlinkedSalesRecordsHandler
  );
