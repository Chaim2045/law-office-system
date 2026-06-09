/**
 * validateSalesRecordExists — Phase 2 H.1.b (Pattern A: live cross-project read)
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin-gated v2 callable that reads ONE specific sales_record from the
 * tofes-mecher project (law-office-sales-form) via the cross-project named app
 * and returns a FIELD-MINIMIZED snapshot for the future H.6 cutover flow
 * (createClientFromSalesRecord). This is the Pattern-A "commit" read of the DLR
 * (MASTER_PLAN §8.2.5 #6): discover via the Pattern-D mirror, COMMIT via one
 * live read of the specific sale.
 *
 * Supersedes the H.0 `tofesMecherConnectivityCheck` (DELETED in this PR): it
 * proves the identical wiring (Secret → named app → tofes Firestore read) AND
 * does real work — the REPURPOSE-OR-DELETE debt is resolved (MASTER_PLAN §8.3).
 *
 * ─── Design contract (H.1.b checkpoint, Haim-approved 2026-06-09) ────────────
 *  1. v2 `onCall` with `{ secrets: [TOFES_KEY] }`; handler exported for tests.
 *  2. Role-only admin gate (`claims.role === 'admin'`); rejects unauth +
 *     non-admin + legacy `admin:true`-only (the Pre-H.0.0.E follow-up gate).
 *  3. Zod `.strict()` input `{ salesRecordId }` pinned to the 20-char Firestore
 *     auto-id shape (`/^[A-Za-z0-9]{20}$/`) — also hard-bounds path safety
 *     (a charset-bounded id cannot traverse out of the collection in `.doc()`).
 *  4. FIELD MINIMIZATION (security default-deny): returns ONLY the 9 fields the
 *     H.6 create-client decision + the DLR four-amounts confirm UI need —
 *     clientName, idNumber, the 4 amounts, transactionType, timestamp. EXCLUDES
 *     address/phone/email and all instrument/routing/installment fields. NEVER
 *     `return snap.data()` — a server-side allowlist projection (Firestore is
 *     schemaless, so a future tofes field must not leak unseen to the browser).
 *  5. NON-PII ACCESS AUDIT (H.1.b checkpoint): every lookup writes an audit_log
 *     entry via `logCriticalAction('VALIDATE_SALES_RECORD', uid, {salesRecordId,
 *     found})` — NEVER ת"ז / amounts / name. Closes the IDOR-without-trace gap
 *     (devils-advocate 🔴): an admin pulling a customer's ת"ז + financials from
 *     a SECOND project via an over-read SA leaves a durable forensic record. The
 *     audit is a PRECONDITION for disclosure — if it throws, the PII is NOT
 *     returned (fail-secure, the audit-FIRST discipline of `logCriticalAction`).
 *  6. snapshot-never-re-derive (DLR): RAW field values, NO computation. The ONLY
 *     transform is Timestamp → ISO string. No VAT math, no fee-pick (the
 *     consumer picks `amountBeforeVat`, D1), no parseInt of string-numerics, no
 *     date parsing.
 *  7. Not-found → `{ exists: false }` (a legitimate H.6 discovery state, NOT an
 *     error) + a distinct non-PII `logger.warn`: the id is expected to come from
 *     the Pattern-D mirror and SHOULD exist, so a missing live doc is a
 *     mirror/live divergence worth surfacing (DLR #6/#7).
 *  8. NO PII to `logger.*` — only uid, salesRecordId, errorCode, found-bool.
 *  9. Hebrew customer-facing errors (G1/G5); sanitized credential errors (no key
 *     fragment) via `getTofesMecherApp`.
 */
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { z } from 'zod';

import {
  REGION,
  TOFES_MECHER_SA_KEY_SECRET,
  TOFES_SALES_COLLECTION
} from '../config';
import { getTofesMecherApp, TofesMecherCredentialError } from './app';
import { logCriticalAction } from '../audit-critical';
import * as logger from '../../shared/logger';

const TOFES_KEY = defineSecret(TOFES_MECHER_SA_KEY_SECRET);

/** Stable audit action key (the payload is non-PII: salesRecordId + found). */
const AUDIT_ACTION = 'VALIDATE_SALES_RECORD';

/**
 * Input schema — strict. `salesRecordId` is a tofes Firestore auto-id (20 chars,
 * `[A-Za-z0-9]`). The charset bound also prevents any path traversal in `.doc()`.
 */
export const validateSalesRecordInputSchema = z
  .object({
    salesRecordId: z
      .string()
      .regex(/^[A-Za-z0-9]{20}$/, 'מזהה רשומת מכר אינו תקין.')
  })
  .strict();

/**
 * The field-minimized snapshot returned to the admin client — 9 fields ONLY:
 * identity + the four amounts + classification + recency, exactly what the H.6
 * cutover needs. RAW values (no derivation); `timestamp` is the one transform
 * (→ ISO string). Amounts are `number | null` (null = absent; 0 is a VALID fee
 * and must stay distinct from "missing"). String fields default to `''`.
 */
export interface SalesRecordSnapshot {
  salesRecordId: string;
  clientName: string;
  idNumber: string;
  amountBeforeVat: number | null;
  vatAmount: number | null;
  amountWithVat: number | null;
  amount: number | null;
  transactionType: string;
  timestampIso: string | null;
}

export type ValidateSalesRecordResponse =
  | ({ exists: true } & SalesRecordSnapshot)
  | { exists: false; salesRecordId: string };

/** Absent/non-string field → '' (stable wire shape; never `undefined`). */
function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** Absent/non-finite number → null (0 is a valid fee; absent must differ). */
function asNumberOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Firestore Timestamp → ISO 8601 string (the ONLY transform). null if absent. */
function asTimestampIso(v: unknown): string | null {
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
 * Internal handler — exported separately for direct unit testing (no v2
 * wrapping / region routing needed in tests).
 */
export async function validateSalesRecordExistsHandler(
  request: CallableRequest<unknown>
): Promise<ValidateSalesRecordResponse> {
  // ─── (1) Auth gate (role-only admin) ──────────────────────────────────────
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'נדרשת התחברות למערכת.');
  }
  const claims = (request.auth.token ?? {}) as { role?: string };
  if (claims.role !== 'admin') {
    throw new HttpsError(
      'permission-denied',
      'רק מנהל מערכת רשאי לאמת רשומת מכר.'
    );
  }
  const callerUid = request.auth.uid;

  // ─── (2) Input validation (Zod, strict) ───────────────────────────────────
  const parsed = validateSalesRecordInputSchema.safeParse(request.data);
  if (!parsed.success) {
    const fieldPath = parsed.error.issues[0]?.path?.join('.') ?? 'salesRecordId';
    logger.warn('tofes_mecher.validate.invalid_input', {
      actor: { uid: callerUid },
      issueField: fieldPath
    });
    throw new HttpsError(
      'invalid-argument',
      `נתונים לא תקינים: שדה "${fieldPath}". אנא נסה שוב.`
    );
  }
  const { salesRecordId } = parsed.data;

  // ─── (3) Init the named app (sanitized credential errors) ──────────────────
  let app;
  try {
    app = getTofesMecherApp(TOFES_KEY.value());
  } catch (err: unknown) {
    const name = err instanceof TofesMecherCredentialError
      ? err.name
      : 'unknown_init_error';
    logger.error('tofes_mecher.validate.init_failed', {
      actor: { uid: callerUid },
      errorName: name
    });
    throw new HttpsError(
      'internal',
      'שגיאה באתחול החיבור לטופס המכר. ודא שהמפתח הוגדר כראוי ונסה שוב, או פנה לתמיכה.'
    );
  }

  // ─── (4) One live read of the specific sale (collection hard-scoped) ───────
  let snap;
  try {
    snap = await app.firestore()
      .collection(TOFES_SALES_COLLECTION)
      .doc(salesRecordId)
      .get();
  } catch (err: unknown) {
    const error = err as { code?: string };
    // errorCode only — never error.message (could echo project/collection data).
    logger.error('tofes_mecher.validate.read_failed', {
      actor: { uid: callerUid },
      salesRecordId,
      errorCode: error.code
    });
    throw new HttpsError(
      'unavailable',
      'לא ניתן להתחבר לטופס המכר כעת. ודא שלחשבון השירות יש הרשאת קריאה ונסה שוב.'
    );
  }

  const found = Boolean(snap.exists);

  // ─── (5) Non-PII access audit — PRECONDITION for disclosure ────────────────
  // Records WHO pulled WHICH sale (uid + salesRecordId + found) — NEVER ת"ז /
  // amounts / clientName. If the audit write fails, the PII is NOT disclosed
  // (fail-secure: no durable trace → no cross-project PII to the browser).
  try {
    await logCriticalAction(AUDIT_ACTION, callerUid, { salesRecordId, found });
  } catch {
    // logCriticalAction already emitted audit_critical.write_failed (errorCode
    // only). Do NOT echo the error here.
    throw new HttpsError(
      'internal',
      'לא ניתן לתעד את הגישה לרשומת המכר כעת. אנא נסה שוב או פנה לתמיכה.'
    );
  }

  // ─── (6) Not found → {exists:false} + divergence warn (DLR #6/#7) ──────────
  if (!found) {
    // The id is expected from the Pattern-D mirror and SHOULD exist; a missing
    // live doc = mirror/live divergence worth surfacing (non-PII, no throw).
    logger.warn('tofes_mecher.validate.not_found', {
      actor: { uid: callerUid },
      salesRecordId
    });
    return { exists: false, salesRecordId };
  }

  // ─── (7) Field-minimized projection (allowlist; RAW; one transform) ────────
  const data = snap.data() ?? {};
  logger.info('tofes_mecher.validate.found', {
    actor: { uid: callerUid },
    salesRecordId
    // NO PII (idNumber / clientName / amounts) ever reaches Cloud Logging.
  });

  return {
    exists: true,
    salesRecordId,
    clientName: asString(data.clientName),
    idNumber: asString(data.idNumber),
    amountBeforeVat: asNumberOrNull(data.amountBeforeVat),
    vatAmount: asNumberOrNull(data.vatAmount),
    amountWithVat: asNumberOrNull(data.amountWithVat),
    amount: asNumberOrNull(data.amount),
    transactionType: asString(data.transactionType),
    timestampIso: asTimestampIso(data.timestamp)
  };
}

// ─── v2 Cloud Function wrapper ──────────────────────────────────────────────
export const validateSalesRecordExists =
  onCall<unknown, Promise<ValidateSalesRecordResponse>>(
    { region: REGION, secrets: [TOFES_KEY] },
    validateSalesRecordExistsHandler
  );
