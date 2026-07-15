/**
 * releaseClientFromPendingSignature — Phase 2 H.6.c-3 (the cutover core, RELEASE phase)
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin-gated v2 callable that completes the two-phase `pending_signature` flow
 * (H.6.c-1 created the client in `pending_signature`; this CF verifies the
 * uploaded signed fee-agreement via H.5 and, if it passes, ATOMICALLY flips the
 * client to `active` and writes the permanent `sales_record_links` fee-snapshot
 * doc — the write c-1 deliberately deferred to this CF).
 *
 * ─── Flow ──────────────────────────────────────────────────────────────────
 *  1. Admin sees a pending client on `pending-clients.html` and has already
 *     uploaded a signed fee-agreement PDF (the existing `feeAgreements` upload
 *     flow — out of scope here).
 *  2. Admin clicks "בדוק חתימה ואשר" — this CF:
 *     a. resolves `salesRecordId` → `{caseNumber, serviceId}` via the c-1
 *        `pending_signature_intents/{salesRecordId}` marker;
 *     b. reads `clients/{caseNumber}`, asserts `status==='pending_signature'`
 *        and at least one `feeAgreements[]` entry exists;
 *     c. verifies the LAST-uploaded agreement via the SHARED H.5 core
 *        {@link verifySignatureCore} (no `CallableRequest` fabrication — this CF
 *        already has a real `callerUid` from its own admin gate);
 *     d. if the verdict fails → returns `{released:false, ...booleans}` — NEVER
 *        the model's `reasoning` (it can quote PII off the document);
 *     e. if it passes → LIVE-reads the sale, checks the fee hasn't drifted, then
 *        atomically flips the client to `active` + writes `sales_record_links`.
 *
 * ─── Design contract (locked, mirrors the H.5 + H.6.c-1 conventions) ────────
 *  1. v2 `onCall` with `{ secrets: [ANTHROPIC_KEY, TOFES_KEY] }` (H.5 needs
 *     Anthropic; the fee-drift check needs a live tofes read); `maxInstances: 3`
 *     (matches H.5's ceiling — this CF calls H.5 internally, same paid-API +
 *     PII-egress containment); `timeoutSeconds: 120` (AI call + cross-project
 *     read + transaction can exceed the v2 default 60s).
 *  2. Role-only admin gate (`claims.role === 'admin'`) — rejects unauth +
 *     non-admin + legacy `admin:true`-only.
 *  3. Zod `.strict()` input `{ salesRecordId }` pinned to the 20-char tofes
 *     auto-id shape (also blocks `.doc()` path traversal).
 *  4. NEVER return the H.5 `reasoning` — it may contain PII quoted off the PDF.
 *     Only the two presence booleans + confidence cross the wire on a failed
 *     verdict.
 *  5. Fee-drift check (₪1 tolerance) BEFORE the transaction — the sale is
 *     cross-project (Pattern A) and cannot be read inside a Firestore txn.
 *  6. AUDIT-FIRST, mutation-SECOND, INSIDE the transaction
 *     (`logCriticalActionInTxn('RELEASE_CLIENT_FROM_PENDING_SIGNATURE', ...)`) —
 *     the audit commits atomically with the status flip + the link write.
 *     Payload is NON-PII (business ids + booleans + confidence — NEVER
 *     `reasoning`, NEVER the amount).
 *  7. TOCTOU guard: the client doc is RE-READ inside the transaction and
 *     `status==='pending_signature'` is RE-ASSERTED. If it has already been
 *     released (a concurrent double-click / re-call) → returns
 *     `{released:false, reason:'CLIENT_ALREADY_RELEASED'}` — NOT an error
 *     (idempotent no-op).
 *  8. `sales_record_links/{salesRecordId}` is written via `.create()` (not
 *     `.set()`) — race-safe: a concurrent double-release collides on the doc id
 *     and aborts + retries.
 *  9. `activeServices` is COMPUTED by counting `status==='active'` in the
 *     (locally mutated) services array — never hardcoded.
 * 10. NO PII to `logger.*` — only uid, business ids (salesRecordId/caseNumber/
 *     serviceId/agreementId), booleans, confidence, errorCode. NEVER the
 *     amount / clientName / idNumber / reasoning.
 * 11. Hebrew customer-facing errors everywhere (G1/G5).
 *
 * ⚠️ PII EGRESS: this CF, via {@link verifySignatureCore}, sends the full signed
 * document to Anthropic's external API. The DPA / privacy-law basis was
 * resolved 2026-07-01 (MASTER_PLAN §8.8) — this is the first LIVE consumer of
 * that egress path.
 */
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { z } from 'zod';
import * as admin from 'firebase-admin';

import { REGION, ANTHROPIC_API_KEY_SECRET, TOFES_MECHER_SA_KEY_SECRET } from '../config';
import { verifySignatureCore } from '../signatures/verify-signature-presence';
import { readSalesRecordSnapshot } from '../tofes-mecher/validate-sales-record';
import { TofesMecherCredentialError } from '../tofes-mecher/app';
import { logCriticalActionInTxn } from '../audit-critical';
import * as logger from '../../shared/logger';

const ANTHROPIC_KEY = defineSecret(ANTHROPIC_API_KEY_SECRET);
const TOFES_KEY = defineSecret(TOFES_MECHER_SA_KEY_SECRET);

/** Stable audit action (payload is NON-PII: business ids + booleans + confidence). */
const AUDIT_ACTION = 'RELEASE_CLIENT_FROM_PENDING_SIGNATURE';

const CLIENTS_COLLECTION = 'clients';
const PENDING_SIGNATURE_INTENTS_COLLECTION = 'pending_signature_intents';
const SALES_RECORD_LINKS_COLLECTION = 'sales_record_links';

/** Fee-drift tolerance (₪) — absorbs floating-point / rounding noise, not real drift. */
const FEE_DRIFT_TOLERANCE = 1;

/**
 * Input schema — strict. `salesRecordId` is a tofes Firestore auto-id (20 chars,
 * `[A-Za-z0-9]`). The charset bound also prevents any path traversal in `.doc()`.
 */
export const releaseClientFromPendingSignatureInputSchema = z
  .object({
    salesRecordId: z
      .string()
      .regex(/^[A-Za-z0-9]{20}$/, 'מזהה רשומת מכר אינו תקין.')
  })
  .strict();

export interface ReleaseClientFromPendingSignatureResponse {
  /** true = the client was flipped to `active` in this call. */
  released: boolean;
  /** present when released:true, or when a status/agreement was already resolved. */
  caseNumber?: string;
  /** present ONLY on the idempotent already-released no-op (released:false, no error). */
  reason?: 'CLIENT_ALREADY_RELEASED';
  /** present ONLY when released:false due to a failed/borderline signature verdict. */
  clientSignaturePresent?: boolean;
  lawyerSignaturePresent?: boolean;
  confidence?: number;
}

interface FeeAgreementMeta {
  id?: string;
  storagePath?: string;
}

interface ClientService {
  id?: string;
  status?: string;
  fixedPrice?: number;
  [key: string]: unknown;
}

/**
 * Internal handler — exported separately for direct unit testing (H.5's core,
 * the tofes read, firebase-admin firestore/transaction, the secrets, and the
 * audit primitive are all mocked; no real cross-project call, AI egress, or
 * Firestore write occurs in tests).
 */
export async function releaseClientFromPendingSignatureHandler(
  request: CallableRequest<unknown>
): Promise<ReleaseClientFromPendingSignatureResponse> {
  // ─── (1) Auth gate (role-only admin) ──────────────────────────────────────
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'נדרשת התחברות למערכת.');
  }
  const claims = (request.auth.token ?? {}) as { role?: string };
  if (claims.role !== 'admin') {
    throw new HttpsError(
      'permission-denied',
      'רק מנהל מערכת רשאי לאשר לקוח לאחר בדיקת חתימה.'
    );
  }
  const adminUid = request.auth.uid;

  // ─── (2) Input validation (Zod, strict) ───────────────────────────────────
  const parsed = releaseClientFromPendingSignatureInputSchema.safeParse(request.data);
  if (!parsed.success) {
    const fieldPath = parsed.error.issues[0]?.path?.join('.') ?? 'salesRecordId';
    logger.warn('cutover.release_client.invalid_input', {
      actor: { uid: adminUid },
      issueField: fieldPath
    });
    throw new HttpsError(
      'invalid-argument',
      `נתונים לא תקינים: שדה "${fieldPath}". אנא נסה שוב.`
    );
  }
  const { salesRecordId } = parsed.data;

  const db = admin.firestore();

  // ─── (3) Resolve the pending intent → {caseNumber, serviceId} ─────────────
  let intentSnap;
  try {
    intentSnap = await db.collection(PENDING_SIGNATURE_INTENTS_COLLECTION).doc(salesRecordId).get();
  } catch (err: unknown) {
    const error = err as { code?: string };
    logger.error('cutover.release_client.intent_read_failed', {
      actor: { uid: adminUid },
      salesRecordId,
      errorCode: error.code
    });
    throw new HttpsError('unavailable', 'לא ניתן לטעון את רשומת ההמתנה לחתימה כעת. אנא נסה שוב.');
  }
  if (!intentSnap.exists) {
    throw new HttpsError('not-found', 'לא נמצאה רשומת המתנה לחתימה עבור מכר זה.');
  }
  const intent = intentSnap.data() ?? {};
  const caseNumber = typeof intent.caseNumber === 'string' ? intent.caseNumber : '';
  const serviceId = typeof intent.serviceId === 'string' ? intent.serviceId : '';
  if (!caseNumber || !serviceId) {
    logger.error('cutover.release_client.intent_malformed', {
      actor: { uid: adminUid },
      salesRecordId
    });
    throw new HttpsError('internal', 'רשומת ההמתנה לחתימה פגומה. אנא פנה לתמיכה.');
  }

  const clientRef = db.collection(CLIENTS_COLLECTION).doc(caseNumber);

  // ─── (4) Read the client doc — status + feeAgreements preconditions ───────
  let clientSnap;
  try {
    clientSnap = await clientRef.get();
  } catch (err: unknown) {
    const error = err as { code?: string };
    logger.error('cutover.release_client.client_read_failed', {
      actor: { uid: adminUid },
      salesRecordId,
      caseNumber,
      errorCode: error.code
    });
    throw new HttpsError('unavailable', 'לא ניתן לטעון את פרטי הלקוח כעת. אנא נסה שוב.');
  }
  if (!clientSnap.exists) {
    throw new HttpsError('not-found', 'הלקוח לא נמצא במערכת.');
  }
  const clientData = clientSnap.data() ?? {};
  if (clientData.status !== 'pending_signature') {
    throw new HttpsError('failed-precondition', 'הלקוח אינו ממתין לבדיקת חתימה.');
  }
  const feeAgreements: FeeAgreementMeta[] = Array.isArray(clientData.feeAgreements)
    ? clientData.feeAgreements
    : [];
  if (feeAgreements.length === 0) {
    throw new HttpsError('failed-precondition', 'טרם הועלה הסכם שכר טרחה חתום עבור לקוח זה.');
  }

  // ─── (5) Determine which agreement to verify — the LAST-uploaded entry ────
  const lastAgreement = feeAgreements[feeAgreements.length - 1];
  const agreementId = typeof lastAgreement?.id === 'string' ? lastAgreement.id : '';
  if (!agreementId) {
    logger.error('cutover.release_client.agreement_malformed', {
      actor: { uid: adminUid },
      salesRecordId,
      caseNumber
    });
    throw new HttpsError('failed-precondition', 'הסכם שכר הטרחה האחרון אינו תקין.');
  }

  // ─── (6) Call the SHARED H.5 core (audit-first + download + Claude call) ──
  let verdict: Awaited<ReturnType<typeof verifySignatureCore>>;
  try {
    verdict = await verifySignatureCore(adminUid, caseNumber, agreementId, 'clients');
  } catch (err: unknown) {
    if (err instanceof HttpsError) {
      throw err;
    }
    logger.error('cutover.release_client.signature_check_failed', {
      actor: { uid: adminUid },
      salesRecordId,
      caseNumber
    });
    throw new HttpsError(
      'internal',
      'בדיקת החתימה נכשלה כעת. אנא נסה שוב מאוחר יותר או פנה לתמיכה.'
    );
  }

  // ─── (7) Failed / borderline verdict → NEVER return reasoning ─────────────
  if (!verdict.passed) {
    logger.info('cutover.release_client.signature_not_passed', {
      actor: { uid: adminUid },
      salesRecordId,
      caseNumber,
      clientSignaturePresent: verdict.clientSignaturePresent,
      lawyerSignaturePresent: verdict.lawyerSignaturePresent
    });
    return {
      released: false,
      clientSignaturePresent: verdict.clientSignaturePresent,
      lawyerSignaturePresent: verdict.lawyerSignaturePresent,
      confidence: verdict.confidence
    };
  }

  // ─── (8) Passed → LIVE-read the sale (cross-project, cannot be in a txn) ──
  let sale: Awaited<ReturnType<typeof readSalesRecordSnapshot>>;
  try {
    sale = await readSalesRecordSnapshot(TOFES_KEY.value(), salesRecordId);
  } catch (err: unknown) {
    if (err instanceof TofesMecherCredentialError) {
      logger.error('cutover.release_client.tofes_init_failed', {
        actor: { uid: adminUid },
        salesRecordId,
        errorName: err.name
      });
      throw new HttpsError(
        'internal',
        'שגיאה באתחול החיבור לטופס המכר. אנא נסה שוב מאוחר יותר או פנה לתמיכה.'
      );
    }
    const error = err as { code?: string };
    logger.error('cutover.release_client.tofes_read_failed', {
      actor: { uid: adminUid },
      salesRecordId,
      errorCode: error.code
    });
    throw new HttpsError('unavailable', 'לא ניתן לקרוא את רשומת המכר כעת. אנא נסה שוב מאוחר יותר.');
  }
  if (!sale.exists) {
    logger.warn('cutover.release_client.sale_not_found', {
      actor: { uid: adminUid },
      salesRecordId,
      caseNumber
    });
    throw new HttpsError(
      'failed-precondition',
      'רשומת המכר לא נמצאה במערכת המקור. לא ניתן לשחרר את הלקוח.'
    );
  }

  // ─── (9) Fee-drift check (₪1 tolerance) — BEFORE the transaction ──────────
  const services: ClientService[] = Array.isArray(clientData.services) ? clientData.services : [];
  const service = services.find((s) => s && s.id === serviceId);
  const clientFixedPrice = typeof service?.fixedPrice === 'number' ? service.fixedPrice : null;
  const saleAmount = sale.amountBeforeVat;
  if (
    clientFixedPrice === null ||
    typeof saleAmount !== 'number' ||
    !Number.isFinite(saleAmount) ||
    Math.abs(saleAmount - clientFixedPrice) > FEE_DRIFT_TOLERANCE
  ) {
    logger.warn('cutover.release_client.fee_drift', {
      actor: { uid: adminUid },
      salesRecordId,
      caseNumber,
      serviceId
    });
    throw new HttpsError(
      'failed-precondition',
      'סכום העסקה במערכת המכר שונה מהסכום שנרשם בלקוח. נא לבדוק ולעדכן.'
    );
  }

  // ─── (10) TOCTOU-safe transaction: audit-FIRST, status flip, link write ───
  const linksRef = db.collection(SALES_RECORD_LINKS_COLLECTION).doc(salesRecordId);
  let result: ReleaseClientFromPendingSignatureResponse;
  try {
    result = await db.runTransaction(async (transaction) => {
      const freshSnap = await transaction.get(clientRef);
      if (!freshSnap.exists) {
        throw new HttpsError('not-found', 'הלקוח לא נמצא במערכת.');
      }
      const freshData = freshSnap.data() ?? {};

      // 10a. Re-assert status — a concurrent release/re-call is an idempotent no-op.
      if (freshData.status !== 'pending_signature') {
        return { released: false, reason: 'CLIENT_ALREADY_RELEASED' as const };
      }

      // 10b. Re-assert the verified agreement still exists.
      const freshAgreements: FeeAgreementMeta[] = Array.isArray(freshData.feeAgreements)
        ? freshData.feeAgreements
        : [];
      if (!freshAgreements.some((a) => a && a.id === agreementId)) {
        throw new HttpsError(
          'failed-precondition',
          'הסכם שכר הטרחה שאומת אינו קיים עוד עבור לקוח זה. אנא נסה שוב.'
        );
      }

      // 10c. Find the pending service by id.
      const freshServices: ClientService[] = Array.isArray(freshData.services) ? freshData.services : [];
      const serviceIndex = freshServices.findIndex((s) => s && s.id === serviceId);
      if (serviceIndex === -1 || freshServices[serviceIndex]?.status !== 'pending') {
        throw new HttpsError('failed-precondition', 'השירות אינו במצב הממתין לשחרור.');
      }

      // 10d. AUDIT-FIRST (in-txn) — NEVER reasoning, NEVER the amount.
      logCriticalActionInTxn(transaction, AUDIT_ACTION, adminUid, {
        caseNumber,
        salesRecordId,
        serviceId,
        agreementId,
        clientSignaturePresent: true,
        lawyerSignaturePresent: true,
        confidence: verdict.confidence
      });

      // 10e. Status flip — activeServices is COMPUTED, never hardcoded.
      const updatedServices = freshServices.map((s, i) =>
        i === serviceIndex ? { ...s, status: 'active' } : s
      );
      const activeServices = updatedServices.filter((s) => s?.status === 'active').length;

      transaction.update(clientRef, {
        status: 'active',
        services: updatedServices,
        activeServices,
        lastModifiedBy: adminUid,
        lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 10f. Permanent fee-snapshot link — `.create()` (race-safe backstop).
      transaction.create(linksRef, {
        caseNumber,
        salesRecordId,
        serviceId,
        agreedFeeSnapshot: {
          amountBeforeVat: sale.amountBeforeVat,
          vatAmount: sale.vatAmount,
          amountWithVat: sale.amountWithVat,
          amount: sale.amount
        },
        feeFieldUsed: 'amountBeforeVat',
        salesRecordUpdatedAt: sale.timestampIso ?? null,
        snapshotAt: admin.firestore.FieldValue.serverTimestamp(),
        confirmedBy: adminUid,
        state: 'matched'
      });

      return { released: true, caseNumber };
    });
  } catch (err: unknown) {
    if (err instanceof HttpsError) {
      throw err;
    }
    const error = err as { code?: string };
    logger.error('cutover.release_client.txn_failed', {
      actor: { uid: adminUid },
      salesRecordId,
      caseNumber,
      errorCode: error.code
    });
    throw new HttpsError(
      'internal',
      'שחרור הלקוח נכשל כעת. אנא נסה שוב מאוחר יותר או פנה לתמיכה.'
    );
  }

  // ─── (11) Non-PII outcome log (NEVER the amount / reasoning) ──────────────
  logger.info('cutover.release_client.completed', {
    actor: { uid: adminUid },
    salesRecordId,
    caseNumber,
    released: result.released,
    reason: result.reason ?? null
  });

  return result;
}

// ─── v2 Cloud Function wrapper ──────────────────────────────────────────────
export const releaseClientFromPendingSignature = onCall<
  unknown,
  Promise<ReleaseClientFromPendingSignatureResponse>
>(
  {
    region: REGION,
    secrets: [ANTHROPIC_KEY, TOFES_KEY],
    // Matches H.5's containment ceiling — this CF calls verifySignatureCore
    // internally (paid Anthropic call + PII egress), same blast-radius bound.
    maxInstances: 3,
    // AI call + cross-project read + transaction can exceed the v2 default 60s.
    timeoutSeconds: 120
  },
  releaseClientFromPendingSignatureHandler
);
