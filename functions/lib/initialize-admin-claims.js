"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeAdminClaims = void 0;
exports.initializeAdminClaimsHandler = initializeAdminClaimsHandler;
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
 *       - Skip if existing claim already matches `{admin:true, role:'admin'}`.
 *       - Prefer `employees.authUID` over email lookup (devils-advocate #4: email
 *         drift means `getUserByEmail` could resolve to the wrong UID).
 *       - Warn on email fallback so future investigation can correlate.
 *  4. Audit-FIRST per employee — same fail-secure pattern as setAdminClaims.
 *  5. DUAL-WRITE `{admin: true, role: 'admin'}` — see setAdminClaims.ts for
 *     the rationale (admin-panel auth.js:424 still reads `claims.admin`).
 *
 * ─── Bootstrap recovery path ────────────────────────────────────────────────
 * This function REQUIRES an existing admin caller. The first-ever admin grant
 * cannot come from this function — it must come from one of:
 *   (a) Firebase Console manual setCustomUserClaims paste.
 *   (b) `functions/scripts/grant-admin-emergency.js` — local-only, requires
 *       service-account credentials that are gitignored.
 * See `docs/ADMIN_CLAIMS_RECOVERY.md` for exact steps.
 */
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const audit_critical_1 = require("./audit-critical");
const logger = __importStar(require("../shared/logger"));
// ─── Constants ──────────────────────────────────────────────────────────────
const BOOTSTRAP_LOCK_PATH = 'system/admin_claims_init_lock';
const LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes — long enough for a real run, short enough to recover from a crash
/**
 * Internal handler — exported separately for direct unit testing.
 */
async function initializeAdminClaimsHandler(request) {
    // ─── (1) Auth gate — dual-shape ───────────────────────────────────────────
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'נדרשת התחברות למערכת.');
    }
    const claims = (request.auth.token ?? {});
    const isAdmin = claims.role === 'admin' || claims.admin === true;
    if (!isAdmin) {
        throw new https_1.HttpsError('permission-denied', 'רק מנהל מערכת רשאי להפעיל סנכרון הרשאות.');
    }
    const callerUid = request.auth.uid;
    const db = admin.firestore();
    const authSdk = admin.auth();
    // ─── (2) Acquire lock — prevent parallel runs ─────────────────────────────
    const lockRef = db.doc(BOOTSTRAP_LOCK_PATH);
    const lockSnap = await lockRef.get();
    if (lockSnap.exists) {
        const lockData = (lockSnap.data() ?? {});
        const lockedAt = lockData.lockedAt;
        const ageMs = lockedAt ? Date.now() - lockedAt.toMillis() : Number.POSITIVE_INFINITY;
        if (ageMs < LOCK_TTL_MS) {
            logger.warn('admin_claims.initialize.locked', {
                actor: { uid: callerUid },
                ageMs
            });
            throw new https_1.HttpsError('failed-precondition', 'סנכרון הרשאות כבר רץ. אנא המתן עד 5 דקות ונסה שוב.');
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
        const results = [];
        for (const empDoc of adminsSnapshot.docs) {
            const empData = empDoc.data() ?? {};
            const email = empData.email;
            const authUidFromFirestore = empData.authUID;
            if (!email) {
                results.push({
                    email: empDoc.id,
                    uid: null,
                    outcome: 'skipped_no_email'
                });
                continue;
            }
            // ─── (3a) Resolve auth user — prefer authUID, fall back to email ──────
            let userRecord;
            try {
                if (authUidFromFirestore) {
                    userRecord = await authSdk.getUser(authUidFromFirestore);
                }
                else {
                    logger.warn('admin_claims.initialize.email_fallback', {
                        actor: { uid: callerUid },
                        employeeDocId: empDoc.id
                    });
                    userRecord = await authSdk.getUserByEmail(email);
                }
            }
            catch (err) {
                const error = err;
                results.push({
                    email,
                    uid: null,
                    outcome: 'skipped_auth_user_missing',
                    errorCode: error.code
                });
                continue;
            }
            // ─── (3b) Idempotency — skip if already dual-shape ────────────────────
            const existingClaims = userRecord.customClaims ?? {};
            const alreadyGranted = existingClaims.admin === true && existingClaims.role === 'admin';
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
                await (0, audit_critical_1.logCriticalAction)('INIT_ADMIN_CLAIM', callerUid, {
                    targetUid: userRecord.uid,
                    targetEmail: email,
                    previousClaims: existingClaims,
                    newClaims: { admin: true, role: 'admin' }
                });
            }
            catch (err) {
                const error = err;
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
            // ─── (3d) Claim write ─────────────────────────────────────────────────
            try {
                await authSdk.setCustomUserClaims(userRecord.uid, {
                    admin: true,
                    role: 'admin'
                });
                results.push({
                    email,
                    uid: userRecord.uid,
                    outcome: 'granted'
                });
            }
            catch (err) {
                const error = err;
                logger.error('admin_claims.initialize.claim_failed', {
                    actor: { uid: callerUid },
                    targetUid: userRecord.uid,
                    errorCode: error.code
                });
                // Compensating audit — best effort
                try {
                    await (0, audit_critical_1.logCriticalAction)('INIT_ADMIN_CLAIM_FAILED', callerUid, {
                        targetUid: userRecord.uid,
                        errorCode: error.code
                    });
                }
                catch {
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
        const failed = results.filter((r) => r.outcome === 'skipped_auth_user_missing' ||
            r.outcome === 'skipped_audit_failed' ||
            r.outcome === 'skipped_claim_failed' ||
            r.outcome === 'skipped_no_email').length;
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
    }
    finally {
        // ─── (4) Release lock — best effort ─────────────────────────────────────
        try {
            await lockRef.delete();
        }
        catch {
            logger.warn('admin_claims.initialize.lock_release_failed', {
                actor: { uid: callerUid }
            });
        }
    }
}
// ─── v2 Cloud Function wrapper ──────────────────────────────────────────────
exports.initializeAdminClaims = (0, https_1.onCall)({ region: 'us-central1' }, initializeAdminClaimsHandler);
//# sourceMappingURL=initialize-admin-claims.js.map