/**
 * initializeAdminClaims — Pre-H.0.0.B (hardened replacement for legacy onCall)
 * ─────────────────────────────────────────────────────────────────────────────
 * Replaces `functions/auth/index.js:255-324` (deleted in this PR), which had
 * the comment "אין בדיקת הרשאות כי זו הפעם הראשונה" — meaning any logged-in
 * user could re-promote every employee with `isAdmin:true` to admin. Worse
 * than the legacy plural setAdminClaims because it's onCall (auth'd) which
 * widens the attack surface to any authenticated session.
 *
 * ─── Design contract ────────────────────────────────────────────────────────
 *  1. v2 `onCall`, admin-gated (dual-shape claim check).
 *  2. Lock doc at `system/admin_claims_init_lock` with 5-minute TTL — prevents
 *     parallel runs (devils-advocate #4: noisy double-grant + metrics drift).
 *  3. Idempotency — for each employee with `isAdmin:true`:
 *       - Skip if existing claim already has `role:'admin'` (Pre-H.0.0.E: the
 *         check is `role`-only — an admin holding the post-contraction shape
 *         must NOT be re-written, else every init run forces a token refresh).
 *       - Prefer `employees.authUID` over email lookup (devils-advocate #4: email
 *         drift means `getUserByEmail` could resolve to the wrong UID).
 *       - Warn on email fallback so future investigation can correlate.
 *  4. Audit-FIRST per employee — same fail-secure pattern as setAdminClaims.
 *  5. SINGLE-SHAPE write `{role: 'admin'}` (Pre-H.0.0.E) — see setAdminClaims.ts
 *     for the rationale. Consumer reads still accept the legacy `{admin:true}`
 *     token shape for one refresh window; that read is retired in §7.4's
 *     FOLLOW-UP PR, not here.
 *
 * ─── Bootstrap recovery path ────────────────────────────────────────────────
 * This function REQUIRES an existing admin caller. The first-ever admin grant
 * cannot come from this function — it must come from one of:
 *   (a) Firebase Console manual setCustomUserClaims paste.
 *   (b) `functions/scripts/grant-admin-emergency.js` — local-only, requires
 *       service-account credentials that are gitignored.
 * See `docs/ADMIN_CLAIMS_RECOVERY.md` for exact steps.
 */
import * as admin from 'firebase-admin';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';

import { logCriticalAction } from './audit-critical';
import * as logger from '../shared/logger';

// ─── Constants ──────────────────────────────────────────────────────────────
const BOOTSTRAP_LOCK_PATH = 'system/admin_claims_init_lock';
const LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes — long enough for a real run, short enough to recover from a crash

// ─── Types ──────────────────────────────────────────────────────────────────
export interface EmployeeResult {
  email: string;
  uid: string | null;
  outcome: 'granted' | 'skipped_already_granted' | 'skipped_no_email' | 'skipped_auth_user_missing' | 'skipped_audit_failed' | 'skipped_claim_failed';
  errorCode?: string;
}

export interface InitializeAdminClaimsResponse {
  success: true;
  scanned: number;
  granted: number;
  skippedAlreadyGranted: number;
  failed: number;
  results: EmployeeResult[];
}

/**
 * Internal handler — exported separately for direct unit testing.
 */
export async function initializeAdminClaimsHandler(
  request: CallableRequest<unknown>
): Promise<InitializeAdminClaimsResponse> {
  // ─── (1) Auth gate — dual-shape ───────────────────────────────────────────
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'נדרשת התחברות למערכת.');
  }
  const claims = (request.auth.token ?? {}) as { role?: string; admin?: boolean };
  const isAdmin = claims.role === 'admin' || claims.admin === true;
  if (!isAdmin) {
    throw new HttpsError(
      'permission-denied',
      'רק מנהל מערכת רשאי להפעיל סנכרון הרשאות.'
    );
  }
  const callerUid = request.auth.uid;

  const db = admin.firestore();
  const authSdk = admin.auth();

  // ─── (2) Acquire lock — prevent parallel runs ─────────────────────────────
  const lockRef = db.doc(BOOTSTRAP_LOCK_PATH);
  const lockSnap = await lockRef.get();
  if (lockSnap.exists) {
    const lockData = (lockSnap.data() ?? {}) as { lockedAt?: admin.firestore.Timestamp; lockedBy?: string };
    const lockedAt = lockData.lockedAt;
    const ageMs = lockedAt ? Date.now() - lockedAt.toMillis() : Number.POSITIVE_INFINITY;
    if (ageMs < LOCK_TTL_MS) {
      logger.warn('admin_claims.initialize.locked', {
        actor: { uid: callerUid },
        ageMs
      });
      throw new HttpsError(
        'failed-precondition',
        'סנכרון הרשאות כבר רץ. אנא המתן עד 5 דקות ונסה שוב.'
      );
    }
    logger.warn('admin_claims.initialize.stale_lock_overridden', {
      actor: { uid: callerUid },
      ageMs
    });
  }
  await lockRef.set({
    lockedAt: admin.firestore.FieldValue.serverTimestamp(),
    lockedBy: callerUid
  });

  try {
    // ─── (3) Scan employees marked isAdmin ──────────────────────────────────
    const adminsSnapshot = await db.collection('employees')
      .where('isAdmin', '==', true)
      .get();

    const results: EmployeeResult[] = [];

    for (const empDoc of adminsSnapshot.docs) {
      const empData = empDoc.data() ?? {};
      const email: string | undefined = empData.email;
      const authUidFromFirestore: string | undefined = empData.authUID;

      if (!email) {
        results.push({
          email: empDoc.id,
          uid: null,
          outcome: 'skipped_no_email'
        });
        continue;
      }

      // ─── (3a) Resolve auth user — prefer authUID, fall back to email ──────
      let userRecord: admin.auth.UserRecord;
      try {
        if (authUidFromFirestore) {
          userRecord = await authSdk.getUser(authUidFromFirestore);
        } else {
          // PII-safe (Pre-H.0.0.E): the employee doc ID IS an email, so it must
          // NOT enter the world-readable logger. The operational signal here is
          // "an employee doc is missing authUID and required email fallback";
          // the specific employee identity stays in audit_log (targetEmail),
          // which is the forensic surface — never logger.* (public repo).
          logger.warn('admin_claims.initialize.email_fallback', {
            actor: { uid: callerUid }
          });
          userRecord = await authSdk.getUserByEmail(email);
        }
      } catch (err: unknown) {
        const error = err as { code?: string };
        results.push({
          email,
          uid: null,
          outcome: 'skipped_auth_user_missing',
          errorCode: error.code
        });
        continue;
      }

      // ─── (3b) Idempotency — skip if already role:'admin' (Pre-H.0.0.E) ────
      // Post-contraction the canonical shape is `{role:'admin'}` with no
      // `admin:true` field, so the check is `role`-only. A `role`-only admin
      // is left untouched (re-writing would needlessly invalidate their token).
      const existingClaims = (userRecord.customClaims ?? {}) as { role?: string };
      const alreadyGranted = existingClaims.role === 'admin';
      if (alreadyGranted) {
        results.push({
          email,
          uid: userRecord.uid,
          outcome: 'skipped_already_granted'
        });
        continue;
      }

      // ─── (3c) Audit FIRST per employee ────────────────────────────────────
      try {
        await logCriticalAction('INIT_ADMIN_CLAIM', callerUid, {
          targetUid: userRecord.uid,
          targetEmail: email,
          previousClaims: existingClaims,
          newClaims: { role: 'admin' }
        });
      } catch (err: unknown) {
        const error = err as { code?: string };
        logger.error('admin_claims.initialize.audit_failed', {
          actor: { uid: callerUid },
          targetUid: userRecord.uid,
          errorCode: error.code
        });
        results.push({
          email,
          uid: userRecord.uid,
          outcome: 'skipped_audit_failed',
          errorCode: error.code
        });
        continue;
      }

      // ─── (3d) Claim write (single-shape: role:'admin' — Pre-H.0.0.E) ──────
      try {
        await authSdk.setCustomUserClaims(userRecord.uid, {
          role: 'admin'
        });
        results.push({
          email,
          uid: userRecord.uid,
          outcome: 'granted'
        });
      } catch (err: unknown) {
        const error = err as { code?: string };
        logger.error('admin_claims.initialize.claim_failed', {
          actor: { uid: callerUid },
          targetUid: userRecord.uid,
          errorCode: error.code
        });
        // Compensating audit — best effort
        try {
          await logCriticalAction('INIT_ADMIN_CLAIM_FAILED', callerUid, {
            targetUid: userRecord.uid,
            errorCode: error.code
          });
        } catch {
          // already throwing below or skipping this result
        }
        results.push({
          email,
          uid: userRecord.uid,
          outcome: 'skipped_claim_failed',
          errorCode: error.code
        });
      }
    }

    const granted = results.filter((r) => r.outcome === 'granted').length;
    const skippedAlreadyGranted = results.filter((r) => r.outcome === 'skipped_already_granted').length;
    const failed = results.filter(
      (r) => r.outcome === 'skipped_auth_user_missing' ||
             r.outcome === 'skipped_audit_failed' ||
             r.outcome === 'skipped_claim_failed' ||
             r.outcome === 'skipped_no_email'
    ).length;

    logger.info('admin_claims.initialize.completed', {
      actor: { uid: callerUid },
      scanned: results.length,
      granted,
      skippedAlreadyGranted,
      failed
    });

    return {
      success: true,
      scanned: results.length,
      granted,
      skippedAlreadyGranted,
      failed,
      results
    };
  } finally {
    // ─── (4) Release lock — best effort ─────────────────────────────────────
    try {
      await lockRef.delete();
    } catch {
      logger.warn('admin_claims.initialize.lock_release_failed', {
        actor: { uid: callerUid }
      });
    }
  }
}

// ─── v2 Cloud Function wrapper ──────────────────────────────────────────────
export const initializeAdminClaims = onCall<unknown, Promise<InitializeAdminClaimsResponse>>(
  { region: 'us-central1' },
  initializeAdminClaimsHandler
);
