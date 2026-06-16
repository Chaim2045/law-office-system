/**
 * getFeeAgreementUrl — Security remediation (on-demand signed-URL access)
 * ─────────────────────────────────────────────────────────────────────────────
 * Replaces the world-readable `file.makePublic()` + permanent public URL pattern
 * for signed fee-agreement PDFs (client full name, ת"ז, signatures, financial
 * terms — חיסיון עו"ד-לקוח + PII under חוק הגנת הפרטיות). The old upload paths
 * (functions/fee-agreements/index.js, functions/src/whatsapp-bot/WhatsAppBot.js)
 * called `makePublic()`, which writes an object-level `allUsers:READER` ACL — that
 * ACL is read via the GCS JSON/XML API and BYPASSES Firebase Storage rules, so the
 * intended `allow read: if isAdmin()` (storage.rules) was a dead letter and every
 * PDF was permanently world-readable.
 *
 * This admin-gated v2 callable issues a SHORT-LIVED (15 min) V4 signed URL on
 * demand, derived from the agreement's server-stored `storagePath`. The frontend
 * fetches a fresh URL per view instead of reading a stored permanent public URL.
 *
 * ─── Design contract (security + backend checkpoint, Haim-approved) ───────────
 *  1. v2 `onCall`; handler exported separately for direct unit testing.
 *  2. Role-only admin gate (`claims.role === 'admin'`); rejects unauth, non-admin,
 *     and the legacy `admin:true`-only token (Pre-H.0.0.E single-shape discipline).
 *  3. Zod `.strict()` input: `entity` ∈ {clients, cases} (allowlist — agreements
 *     live ONLY on those two doc types), `entityId` + `agreementId` charset-bounded
 *     (a bound that also blocks any path traversal in `.doc()`).
 *  4. IDOR-safe + confused-deputy-safe: the `storagePath` to sign is RESOLVED from
 *     the Firestore `feeAgreements[]` array on the named doc by matching
 *     `agreementId` — NEVER a path supplied by the caller. AND the resolved path is
 *     pinned to `${entity}/${entityId}/agreements/` before signing: the Admin SDK
 *     bypasses Storage rules and `feeAgreements[]` is admin-writable via the client
 *     SDK (it is NOT in RESTRICTED_KEYS / clientAggregateKeys), so an admin could
 *     poison a `storagePath` to point at an arbitrary bucket object — the prefix
 *     pin neutralizes that read-oracle (mirrors verify-signature-presence.ts).
 *  5. NON-PII access audit (forensic trail for privileged PII): every issuance
 *     writes `logCriticalAction('GET_FEE_AGREEMENT_URL', uid, {entity, entityId,
 *     agreementId, found})` — business identifiers only, NEVER name/ת"ז/amounts.
 *     The audit is a PRECONDITION for disclosure: if it throws, NO URL is returned
 *     (fail-secure — the audit-FIRST discipline of logCriticalAction).
 *  6. Short TTL: 15 min — long enough to open+read a PDF, short enough that a
 *     leaked URL (browser history / referrer / logs) is dead almost immediately.
 *     The old commented-out `1 year` alternative was the anti-pattern.
 *  7. Hebrew customer-facing errors (G1/G5). Sign/read failures log errorCode
 *     only (NEVER error.message — could echo the SA email or storage internals).
 *  8. NO PII to `logger.*` — only uid, entity, entityId, agreementId, errorCode.
 *
 * ─── Runtime prerequisite ─────────────────────────────────────────────────────
 * V4 `getSignedUrl({action:'read'})` from the Cloud Functions runtime signs via
 * the IAM Credentials API: the runtime service account needs
 * `roles/iam.serviceAccountTokenCreator` on itself + `iamcredentials.googleapis.com`
 * enabled. Without it the FIRST live call fails (deploy-green/runtime-fail trap) —
 * a supervised live-smoke is mandatory before declaring this done.
 */
import * as admin from 'firebase-admin';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { z } from 'zod';

import { REGION } from '../config';
import { logCriticalAction } from '../audit-critical';
import * as logger from '../../shared/logger';

/**
 * Signed-URL time-to-live: 15 minutes. Exported so the test can assert the leak
 * window stays short (a regression toward the old "1 year" must fail CI).
 */
export const SIGNED_URL_TTL_MS = 15 * 60 * 1000;

/** Stable audit action key. Payload is non-PII (entity + ids + found). */
const AUDIT_ACTION = 'GET_FEE_AGREEMENT_URL';

/**
 * Input schema — strict. `entity` is allowlisted to the two doc types that hold
 * `feeAgreements[]`. `entityId`/`agreementId` are charset-bounded: this both
 * rejects malformed ids AND hard-blocks path traversal in `.doc()` (no '/').
 */
export const getFeeAgreementUrlInputSchema = z
  .object({
    entity: z.enum(['clients', 'cases']),
    entityId: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,128}$/, 'מזהה ישות אינו תקין.'),
    agreementId: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,64}$/, 'מזהה הסכם אינו תקין.')
  })
  .strict();

export interface FeeAgreementUrlResponse {
  url: string;
  expiresAt: string; // ISO 8601
}

/** Minimal shape we read off each `feeAgreements[]` item (defensive typing). */
interface AgreementRecord {
  id?: unknown;
  storagePath?: unknown;
}

/**
 * Internal handler — exported separately for direct unit testing (no v2 wrapping
 * / region routing needed in tests).
 */
export async function getFeeAgreementUrlHandler(
  request: CallableRequest<unknown>
): Promise<FeeAgreementUrlResponse> {
  // ─── (1) Auth gate (role-only admin) ──────────────────────────────────────
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'נדרשת התחברות למערכת.');
  }
  const claims = (request.auth.token ?? {}) as { role?: string };
  if (claims.role !== 'admin') {
    throw new HttpsError(
      'permission-denied',
      'רק מנהל מערכת רשאי לצפות בהסכמי שכר טרחה.'
    );
  }
  const callerUid = request.auth.uid;

  // ─── (2) Input validation (Zod, strict) ───────────────────────────────────
  const parsed = getFeeAgreementUrlInputSchema.safeParse(request.data);
  if (!parsed.success) {
    const fieldPath = parsed.error.issues[0]?.path?.join('.') ?? 'input';
    logger.warn('fee_agreement.get_url.invalid_input', {
      actor: { uid: callerUid },
      issueField: fieldPath
    });
    throw new HttpsError(
      'invalid-argument',
      `נתונים לא תקינים: שדה "${fieldPath}". אנא נסה שוב.`
    );
  }
  const { entity, entityId, agreementId } = parsed.data;

  // ─── (3) Resolve storagePath from the doc (server-trusted → blocks IDOR) ───
  let docSnap: admin.firestore.DocumentSnapshot;
  try {
    docSnap = await admin.firestore().collection(entity).doc(entityId).get();
  } catch (err: unknown) {
    const error = err as { code?: string };
    logger.error('fee_agreement.get_url.read_failed', {
      actor: { uid: callerUid },
      entity,
      errorCode: error.code
    });
    throw new HttpsError(
      'unavailable',
      'לא ניתן לטעון את פרטי ההסכם כעת. אנא נסה שוב או פנה לתמיכה.'
    );
  }

  const rawAgreements = docSnap.exists
    ? (docSnap.data()?.feeAgreements as unknown)
    : undefined;
  const list: AgreementRecord[] = Array.isArray(rawAgreements)
    ? (rawAgreements as AgreementRecord[])
    : [];
  const match = list.find(
    (a) => a && typeof a.id === 'string' && a.id === agreementId
  );
  const storagePath =
    match && typeof match.storagePath === 'string' ? match.storagePath : '';
  const found = storagePath.length > 0;
  // Confused-deputy pin: the only shape any legitimate uploader writes (admin CF
  // functions/fee-agreements/index.js:98 + WhatsApp CF WhatsAppBot.js:1882).
  const expectedPrefix = `${entity}/${entityId}/agreements/`;

  // ─── (4) Non-PII access audit — PRECONDITION for disclosure (fail-secure) ──
  try {
    await logCriticalAction(AUDIT_ACTION, callerUid, {
      entity,
      entityId,
      agreementId,
      found
    });
  } catch {
    // logCriticalAction already emitted audit_critical.write_failed (errorCode
    // only). No durable trace → do NOT mint a URL.
    throw new HttpsError(
      'internal',
      'לא ניתן לתעד את הגישה להסכם כעת. אנא נסה שוב או פנה לתמיכה.'
    );
  }

  // ─── (5) Not found → throw (an agreement in the admin UI should resolve) ───
  if (!found) {
    logger.warn('fee_agreement.get_url.not_found', {
      actor: { uid: callerUid },
      entity,
      entityId,
      agreementId
    });
    throw new HttpsError(
      'not-found',
      'ההסכם לא נמצא או חסר נתיב קובץ. ייתכן שנמחק.'
    );
  }

  // ─── (5b) Confused-deputy guard — reject a storagePath that escapes the ────
  // entity's own agreements folder (a poisoned in-doc path). NEVER sign it.
  if (!storagePath.startsWith(expectedPrefix)) {
    logger.error('fee_agreement.get_url.unexpected_storage_path', {
      actor: { uid: callerUid },
      entity,
      entityId,
      agreementId
    });
    throw new HttpsError(
      'failed-precondition',
      'נתיב קובץ ההסכם אינו תקין.'
    );
  }

  // ─── (6) Sign a short-lived V4 read URL ───────────────────────────────────
  const expiresMs = Date.now() + SIGNED_URL_TTL_MS;
  let url: string;
  try {
    const [signed] = await admin
      .storage()
      .bucket()
      .file(storagePath)
      .getSignedUrl({ version: 'v4', action: 'read', expires: expiresMs });
    url = signed;
  } catch (err: unknown) {
    const error = err as { code?: string; name?: string };
    // errorCode/name only — never error.message (could echo SA email / path).
    logger.error('fee_agreement.get_url.sign_failed', {
      actor: { uid: callerUid },
      entity,
      errorCode: error.code ?? error.name
    });
    throw new HttpsError(
      'internal',
      'לא ניתן להפיק קישור לצפייה כעת. אנא נסה שוב או פנה לתמיכה.'
    );
  }

  logger.info('fee_agreement.get_url.success', {
    actor: { uid: callerUid },
    entity,
    entityId,
    agreementId
  });

  return { url, expiresAt: new Date(expiresMs).toISOString() };
}

// ─── v2 Cloud Function wrapper ──────────────────────────────────────────────
export const getFeeAgreementUrl = onCall<unknown, Promise<FeeAgreementUrlResponse>>(
  { region: REGION },
  getFeeAgreementUrlHandler
);
