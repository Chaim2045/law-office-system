/**
 * setAdminClaims — Pre-H.0.0.B (hardened replacement for legacy onRequest)
 * ─────────────────────────────────────────────────────────────────────────────
 * This is the FIRST production endpoint written in TypeScript via the
 * `functions/src-ts/` infrastructure established by PR-META-6.
 *
 * ─── Why this exists ────────────────────────────────────────────────────────
 * The legacy `setAdminClaims` (functions/auth/index.js:329-353, deleted in this
 * PR) was a `functions.https.onRequest` endpoint with ZERO auth check and a
 * hardcoded admin email list. Anyone with the URL could trigger it. The repo
 * is PUBLIC on GitHub. This is the most acute security issue in the codebase.
 *
 * ─── Design contract (derived from Pre-H.0.0.B checkpoint with Haim) ────────
 *  1. v2 `onCall` — built-in auth context, native CORS, App Check ready.
 *  2. Dual-shape admin gate — accepts both `{role:'admin'}` (canonical) and
 *     `{admin:true}` (legacy). Both real production admins are currently on
 *     one or the other; PR-H.0.0.A diagnostic data informs which.
 *  3. Zod schema validation — `{targetUid, role: 'admin'}` only. No email
 *     input (legacy hardcoded emails are removed; UID is unambiguous).
 *  4. Self-elevation BLOCKED — `request.auth.uid !== targetUid`. Devils-advocate
 *     recommended this to prevent token-theft → self-grant chains.
 *  5. Audit-FIRST, claim-SECOND, compensating-log-on-failure — if the audit
 *     doc cannot be written, the claim is NOT written. This is "fail-secure"
 *     against an audit-rule drift that would otherwise silently hide grants.
 *  6. SINGLE-SHAPE custom claim `{role: 'admin'}` (Pre-H.0.0.E, 2026-06-04).
 *     The legacy `{admin: true}` field was retired from this writer — all four
 *     admin-claim writers now emit `role`-only (MASTER_PLAN §7.4). Consumer
 *     reads still ACCEPT the legacy `{admin:true}` token shape for one
 *     token-refresh window (admin-panel auth.js + this file's own auth GATE at
 *     step 1); that read is retired in the §7.4 FOLLOW-UP PR, never here.
 *
 * ─── PUBLIC-REPO SAFETY ─────────────────────────────────────────────────────
 * - No PII in `logger.*` fields — `actor` carries `uid` only, never email.
 * - Hebrew error messages in user-facing throws (G1, G5).
 * - No `process.env.*` references logged (CI logs are world-readable).
 */
import * as admin from 'firebase-admin';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { z } from 'zod';

import { logCriticalAction } from './audit-critical';
import * as logger from '../shared/logger';

// ─── Schema ─────────────────────────────────────────────────────────────────
// Min length 20: Firebase Auth UIDs are at least 28 chars in practice; 20 is
// a defensive lower bound that rejects accidental short test strings without
// being so tight that a legitimate UID is rejected.
const setAdminClaimsSchema = z.object({
  targetUid: z.string().min(20).max(128),
  role: z.literal('admin')
}).strict();

export type SetAdminClaimsInput = z.infer<typeof setAdminClaimsSchema>;

export interface SetAdminClaimsResponse {
  success: true;
  targetUid: string;
  role: 'admin';
  auditDocId: string;
  claimShapeWritten: { role: 'admin' };
}

/**
 * Internal handler — exported separately so tests can invoke it directly
 * without needing the v2 wrapping + region routing.
 *
 * The exported `setAdminClaims` below wraps this in `onCall` for deployment.
 */
export async function setAdminClaimsHandler(
  request: CallableRequest<unknown>
): Promise<SetAdminClaimsResponse> {
  // ─── (1) Auth gate — dual-shape claim acceptance ──────────────────────────
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'נדרשת התחברות למערכת.');
  }
  const claims = (request.auth.token ?? {}) as { role?: string; admin?: boolean };
  const isAdmin = claims.role === 'admin' || claims.admin === true;
  if (!isAdmin) {
    throw new HttpsError(
      'permission-denied',
      'רק מנהל מערכת רשאי להעניק הרשאת admin.'
    );
  }
  const callerUid = request.auth.uid;

  // ─── (2) Input validation (Zod, strict) ───────────────────────────────────
  const parsed = setAdminClaimsSchema.safeParse(request.data);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const fieldPath = firstIssue?.path?.join('.') ?? 'unknown';
    logger.warn('admin_claims.set.invalid_input', {
      actor: { uid: callerUid },
      issueField: fieldPath
    });
    throw new HttpsError(
      'invalid-argument',
      `נתונים לא תקינים: שדה "${fieldPath}". אנא ודא שהפרטים תקינים ונסה שוב.`
    );
  }
  const { targetUid, role }: SetAdminClaimsInput = parsed.data;

  // ─── (3) Self-elevation block ─────────────────────────────────────────────
  if (callerUid === targetUid) {
    logger.warn('admin_claims.set.self_elevation_blocked', {
      actor: { uid: callerUid }
    });
    throw new HttpsError(
      'permission-denied',
      'אסור להעניק הרשאת admin לעצמך. בקש מאדמין אחר.'
    );
  }

  // ─── (4) Resolve target user (proves they exist before audit) ─────────────
  const authSdk = admin.auth();
  let targetUserRecord: admin.auth.UserRecord;
  try {
    targetUserRecord = await authSdk.getUser(targetUid);
  } catch (err: unknown) {
    const error = err as { code?: string };
    logger.error('admin_claims.set.target_not_found', {
      actor: { uid: callerUid },
      targetUid,
      errorCode: error.code
    });
    throw new HttpsError(
      'not-found',
      'המשתמש המבוקש לא נמצא במערכת. ודא שה-UID נכון ונסה שוב.'
    );
  }
  const previousClaims = targetUserRecord.customClaims ?? {};

  // ─── (5) Audit FIRST — if this fails, claim is NOT written ────────────────
  let auditDocId: string;
  try {
    auditDocId = await logCriticalAction('SET_ADMIN_CLAIM', callerUid, {
      targetUid,
      role,
      previousClaims,
      newClaims: { role: 'admin' }
    });
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string };
    logger.error('admin_claims.set.audit_write_failed', {
      actor: { uid: callerUid },
      targetUid,
      errorCode: error.code
    });
    throw new HttpsError(
      'internal',
      'שגיאה בכתיבת לוג ביקורת. ההרשאה לא הוענקה. אנא נסה שוב מאוחר יותר או פנה לתמיכה.'
    );
  }

  // ─── (6) Claim write (single-shape: role:'admin' — Pre-H.0.0.E) ───────────
  try {
    await authSdk.setCustomUserClaims(targetUid, { role: 'admin' });
  } catch (err: unknown) {
    const error = err as { code?: string };
    logger.error('admin_claims.set.claim_write_failed', {
      actor: { uid: callerUid },
      targetUid,
      auditDocId,
      errorCode: error.code
    });
    // Compensating audit doc — original audit said "granted" but claim write
    // failed. Best-effort: if THIS also fails, we still throw below.
    try {
      await logCriticalAction('SET_ADMIN_CLAIM_FAILED', callerUid, {
        targetUid,
        originalAuditDocId: auditDocId,
        errorCode: error.code
      });
    } catch {
      logger.error('admin_claims.set.compensating_audit_failed', {
        actor: { uid: callerUid },
        targetUid,
        originalAuditDocId: auditDocId
      });
    }
    throw new HttpsError(
      'internal',
      'שגיאה בכתיבת הרשאה. ההרשאה לא הוענקה. אנא פנה לתמיכה עם מזהה האירוע.'
    );
  }

  // ─── (7) Success log + return ─────────────────────────────────────────────
  logger.info('admin_claims.set.success', {
    actor: { uid: callerUid },
    targetUid,
    role,
    auditDocId
  });

  return {
    success: true,
    targetUid,
    role,
    auditDocId,
    claimShapeWritten: { role: 'admin' }
  };
}

// ─── v2 Cloud Function wrapper ──────────────────────────────────────────────
// Region matches the existing v1 callables in functions/auth/index.js (default
// us-central1). Keeping consistent avoids cold-start surprises.
export const setAdminClaims = onCall<unknown, Promise<SetAdminClaimsResponse>>(
  { region: 'us-central1' },
  setAdminClaimsHandler
);
