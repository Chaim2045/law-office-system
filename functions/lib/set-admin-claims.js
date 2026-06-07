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
exports.setAdminClaims = void 0;
exports.setAdminClaimsHandler = setAdminClaimsHandler;
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
 *  2. Role-only admin gate — `claims.role === 'admin'`. The legacy `{admin:true}`
 *     acceptance was removed in the Pre-H.0.0.E follow-up (2026-06-05) once PROD
 *     `verifyClaims` confirmed `admin_boolean_only:0` and the token-refresh window
 *     had elapsed; every admin holds `{role:'admin'}`.
 *  3. Zod schema validation — `{targetUid, role: 'admin'}` only. No email
 *     input (legacy hardcoded emails are removed; UID is unambiguous).
 *  4. Self-elevation BLOCKED — `request.auth.uid !== targetUid`. Devils-advocate
 *     recommended this to prevent token-theft → self-grant chains.
 *  5. Audit-FIRST, claim-SECOND, compensating-log-on-failure — if the audit
 *     doc cannot be written, the claim is NOT written. This is "fail-secure"
 *     against an audit-rule drift that would otherwise silently hide grants.
 *  6. SINGLE-SHAPE custom claim `{role: 'admin'}` (Pre-H.0.0.E, 2026-06-04).
 *     The legacy `{admin: true}` field was retired from this writer — all four
 *     admin-claim writers emit `role`-only (MASTER_PLAN §7.4). The Pre-H.0.0.E
 *     FOLLOW-UP (2026-06-05) then retired the legacy boolean from every consumer
 *     READ + auth gate too (incl. this file's gate at step 1). One claim shape
 *     now, end to end.
 *
 * ─── PUBLIC-REPO SAFETY ─────────────────────────────────────────────────────
 * - No PII in `logger.*` fields — `actor` carries `uid` only, never email.
 * - Hebrew error messages in user-facing throws (G1, G5).
 * - No `process.env.*` references logged (CI logs are world-readable).
 */
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const audit_critical_1 = require("./audit-critical");
const logger = __importStar(require("../shared/logger"));
// ─── Schema ─────────────────────────────────────────────────────────────────
// Min length 20: Firebase Auth UIDs are at least 28 chars in practice; 20 is
// a defensive lower bound that rejects accidental short test strings without
// being so tight that a legitimate UID is rejected.
const setAdminClaimsSchema = zod_1.z.object({
    targetUid: zod_1.z.string().min(20).max(128),
    role: zod_1.z.literal('admin')
}).strict();
/**
 * Internal handler — exported separately so tests can invoke it directly
 * without needing the v2 wrapping + region routing.
 *
 * The exported `setAdminClaims` below wraps this in `onCall` for deployment.
 */
async function setAdminClaimsHandler(request) {
    // ─── (1) Auth gate — role-only (Pre-H.0.0.E follow-up) ────────────────────
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'נדרשת התחברות למערכת.');
    }
    const claims = (request.auth.token ?? {});
    const isAdmin = claims.role === 'admin';
    if (!isAdmin) {
        throw new https_1.HttpsError('permission-denied', 'רק מנהל מערכת רשאי להעניק הרשאת admin.');
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
        throw new https_1.HttpsError('invalid-argument', `נתונים לא תקינים: שדה "${fieldPath}". אנא ודא שהפרטים תקינים ונסה שוב.`);
    }
    const { targetUid, role } = parsed.data;
    // ─── (3) Self-elevation block ─────────────────────────────────────────────
    if (callerUid === targetUid) {
        logger.warn('admin_claims.set.self_elevation_blocked', {
            actor: { uid: callerUid }
        });
        throw new https_1.HttpsError('permission-denied', 'אסור להעניק הרשאת admin לעצמך. בקש מאדמין אחר.');
    }
    // ─── (4) Resolve target user (proves they exist before audit) ─────────────
    const authSdk = admin.auth();
    let targetUserRecord;
    try {
        targetUserRecord = await authSdk.getUser(targetUid);
    }
    catch (err) {
        const error = err;
        logger.error('admin_claims.set.target_not_found', {
            actor: { uid: callerUid },
            targetUid,
            errorCode: error.code
        });
        throw new https_1.HttpsError('not-found', 'המשתמש המבוקש לא נמצא במערכת. ודא שה-UID נכון ונסה שוב.');
    }
    const previousClaims = targetUserRecord.customClaims ?? {};
    // ─── (5) Audit FIRST — if this fails, claim is NOT written ────────────────
    let auditDocId;
    try {
        auditDocId = await (0, audit_critical_1.logCriticalAction)('SET_ADMIN_CLAIM', callerUid, {
            targetUid,
            role,
            previousClaims,
            newClaims: { role: 'admin' }
        });
    }
    catch (err) {
        const error = err;
        logger.error('admin_claims.set.audit_write_failed', {
            actor: { uid: callerUid },
            targetUid,
            errorCode: error.code
        });
        throw new https_1.HttpsError('internal', 'שגיאה בכתיבת לוג ביקורת. ההרשאה לא הוענקה. אנא נסה שוב מאוחר יותר או פנה לתמיכה.');
    }
    // ─── (6) Claim write (single-shape: role:'admin' — Pre-H.0.0.E) ───────────
    try {
        await authSdk.setCustomUserClaims(targetUid, { role: 'admin' });
    }
    catch (err) {
        const error = err;
        logger.error('admin_claims.set.claim_write_failed', {
            actor: { uid: callerUid },
            targetUid,
            auditDocId,
            errorCode: error.code
        });
        // Compensating audit doc — original audit said "granted" but claim write
        // failed. Best-effort: if THIS also fails, we still throw below.
        try {
            await (0, audit_critical_1.logCriticalAction)('SET_ADMIN_CLAIM_FAILED', callerUid, {
                targetUid,
                originalAuditDocId: auditDocId,
                errorCode: error.code
            });
        }
        catch {
            logger.error('admin_claims.set.compensating_audit_failed', {
                actor: { uid: callerUid },
                targetUid,
                originalAuditDocId: auditDocId
            });
        }
        throw new https_1.HttpsError('internal', 'שגיאה בכתיבת הרשאה. ההרשאה לא הוענקה. אנא פנה לתמיכה עם מזהה האירוע.');
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
exports.setAdminClaims = (0, https_1.onCall)({ region: 'us-central1' }, setAdminClaimsHandler);
//# sourceMappingURL=set-admin-claims.js.map